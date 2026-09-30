#!/usr/bin/env python3
"""GATA autopilot keeper - runs on the app box, holds NO key.

Every KEEPER_TICK (60 s) it reads, from the chain, every StakeAuthorization REDELEGATE
grant made to the signer's address. Each granter is planned every 6 hours (at once when
new): would moving some of their stake earn them more - the same arithmetic the page uses
(ADR-004: rate = (1 - c) * (a + b / (t + x)) with the live eta)?

THE ADMIN GATE: a plan is only a proposal. It is executed only after an operator approves
exactly that plan (its id) in the admin console; every grant waits for an operator first,
and every later plan that differs waits again. 48 hours to decide; Discord at 3 hours left
and every 12 hours once overdue - never an automatic apply. Approved, it asks the remote
signer (its own key) to execute MsgExec{MsgBeginRedelegate...}. The chain enforces the
grant's allow-list and cap on top of everything here. Restake has no admin step.

What this will never do: move stake that is still in its 21-day cooldown, move to a
jailed or tombstoned validator, move to a validator outside the grant's allow-list,
exceed the grant's remaining cap, make more than KEEPER_MAX_MOVES_PER_DAY moves for
one granter in a day, move without an operator's approval of that exact plan, or sign
anything while KEEPER_DRY=1 (the default: an approved plan is recorded as applied, dry).

State: /srv/atomone-app/keeper/state/keeper.db (sqlite: runs, moves); KEEPER_STATE overrides.
Report per granter: /srv/atomone-app/web/keeper/<granter>.json (the page shows it); KEEPER_REPORTS.
Testnet: the same code under atomone-app-keeper-testnet with KEEPER_DATA/STATE/REPORTS/ADMIN
and ATOMONE_API pointed at testnet.
"""
import hashlib, json, os, re, sqlite3, sys, time, urllib.request, urllib.error, urllib.parse

# Discord, through the app's one sender (bin/notify.py; the webhook comes from the unit's alerts env)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "bin"))
try:
    import notify
except Exception:                                   # no sender: alerts are logged, never fatal
    notify = None

API = os.environ.get("ATOMONE_API", "https://atomone-api.gatadao.com")
SIGNER = os.environ.get("KEEPER_SIGNER_URL", "")
SECRET = os.environ.get("KEEPER_SECRET", "")
GRANTEE = os.environ.get("KEEPER_GRANTEE", "").strip()
DRY = os.environ.get("KEEPER_DRY", "1") != "0"
# the operator's rule, fixed here and not in the env (the env files still carried 0.005 and 6 hours from the old
# gated keeper, which would have moved stake for half a point): a move every 12 hours, only for more than 5 APR points
EVERY = 12 * 3600
# the 12-hour cycles are pinned to the clock (operator, 2026-09-30): Autopilot and Restake both run at 00:00 and 12:00 UTC.
# A wallet is due once per slot; a new or changed grant is still planned at once, and retries keep their own waits
def slot0(t=None): return int((time.time() if t is None else t) // EVERY) * EVERY
MIN_GAIN_APR = 0.05
MIN_GAIN_ATONE = 1.0          # and pay at least this per year
MAX_MOVES_DAY = 20            # the signer takes at most 20 moves a transaction
RS_EDGE = 3                   # restake: the last 3 of the set are left out of the highest-APR pick
MIN_MOVE = 1_000_000          # no move under 1 ATONE: dust uses a pair entry and a move slot for nothing
FRESH_S = 3600                # the collector's record older than this, or a chain head older than HEAD_S: no tick
HEAD_S = 180
# restake: claim a granter's rewards and stake them back onto their allow-list. Planned and
# reported always; executed only with KEEPER_RESTAKE=1 AND KEEPER_DRY=0
RESTAKE = os.environ.get("KEEPER_RESTAKE", "0") == "1"
MIN_RESTAKE = float(os.environ.get("KEEPER_MIN_RESTAKE_ATONE", "1"))       # skip while rewards are below this
MAX_CLAIM = int(os.environ.get("KEEPER_MAX_CLAIM", "18"))                  # validators claimed in one transaction (the signer takes 20 messages)
RESTAKE_URL = os.environ.get("KEEPER_RESTAKE_URL", "") or (SIGNER.rsplit("/", 1)[0] + "/authz-restake" if SIGNER else "")
WDRAW_URL = "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"
# one keeper per network: testnet runs a second unit with these pointed at web/testnet
# and its own state (mainnet keeps the defaults)
DATA = os.environ.get("KEEPER_DATA", "/srv/atomone-app/web/data.json")
STATE = os.environ.get("KEEPER_STATE", "/srv/atomone-app/keeper/state/keeper.db")
REPORTS = os.environ.get("KEEPER_REPORTS", "/srv/atomone-app/web/keeper")
LOCK_S = 21 * 86400
NET = os.environ.get("NET", "mainnet")
SITE = os.environ.get("SITE_URL", "https://atomone.gatahub.zone")
TICK = int(os.environ.get("KEEPER_TICK", "60"))           # the loop: approvals and new grants are picked up this fast
SLA_S, WARN_S, OVERDUE_EVERY = 48 * 3600, 3 * 3600, 12 * 3600
RETRY_S = 3600                                            # a failed execution is tried again after this
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
    # the admin gate: what waits for a decision (one row per granter), and every approved plan carried out
    c.execute("CREATE TABLE IF NOT EXISTS pend(granter TEXT PRIMARY KEY, plan_id TEXT, reason TEXT, since INT, deadline INT, warned INT, overdue_at INT, ready_sent TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS applied(at INT, granter TEXT, plan_id TEXT, by TEXT, txhash TEXT, dry INT, ok INT, error TEXT, ap_at INT)")
    c.execute("CREATE TABLE IF NOT EXISTS alert_sent(granter TEXT, k TEXT, at INT, PRIMARY KEY(granter, k))")
    c.execute("CREATE TABLE IF NOT EXISTS rs_run(granter TEXT PRIMARY KEY, at INT)")
    # a move that failed for a fee, network or RPC reason, waiting to be tried again (see classify)
    c.execute("CREATE TABLE IF NOT EXISTS retry(granter TEXT PRIMARY KEY, due INT, tries INT, why TEXT, txhash TEXT, moves TEXT, since INT)")
    return c

# ── the model, as the page has it ──────────────────────────────────────────
def fresh():
    """the inputs are current: the collector's record written within FRESH_S, the chain's head within HEAD_S. A stale
    record could send stake to a validator that has since gone down; a stale node could replan over moves it has not seen"""
    D = json.load(open(DATA)); gen = D.get("generated") or D.get("ts") or 0
    if isinstance(gen, str):
        import datetime
        try: gen = datetime.datetime.fromisoformat(gen.replace("Z", "+00:00")).timestamp()
        except Exception: gen = 0
    if gen > 1e12: gen /= 1000
    if not gen or time.time() - gen > FRESH_S: raise RuntimeError("collector record is stale (generated %s)" % D.get("generated"))
    import datetime
    h = get("/cosmos/base/tendermint/v1beta1/blocks/latest")["block"]["header"]
    t = datetime.datetime.fromisoformat(h["time"][:26].rstrip("Z") + "+00:00").timestamp() if "." in h["time"] else datetime.datetime.fromisoformat(h["time"].replace("Z", "+00:00")).timestamp()
    if time.time() - t > HEAD_S: raise RuntimeError("chain head is stale (block %s at %s)" % (h["height"], h["time"]))

def model():
    D = json.load(open(DATA))
    S, N, R = D["set"]["bonded"], D["set"]["n"], D["set"]["reward_pool"]
    eta = float(D["eta"]["now"])                  # the live eta, never a what-if
    vals = {}
    for v in D["validators"]:
        vals[v["op"]] = {"op": v["op"], "m": v["m"], "t": float(v["t"]), "c": float(v["c"]), "jail": v.get("jail") or 0,
                         "tomb": bool(v.get("tomb")), "d90": v.get("d90"), "up": v.get("up"), "rank": v.get("rank")}
    a = (1 - eta) * R / S; b = eta * R / N
    return vals, (a, b), eta

def rate_after(m, t, c, x): return (1 - c) * (m[0] + m[1] / (t + x))

def live_vals(stats):
    """the active set as the chain has it right now - stakes, commission, who is in - with the collector's record of
    each validator (uptime, jailings) where it has one. A validator the collector does not know yet (it entered the
    set since the last collect) is marked unknown and is no destination until it is."""
    out = {}
    for v in get("/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=300").get("validators", []):
        op = v["operator_address"]; st = stats.get(op) or {}
        out[op] = {"op": op, "m": v["description"]["moniker"], "t": float(v["tokens"]),
                   "c": float(v["commission"]["commission_rates"]["rate"]), "jail": st.get("jail") or 0,
                   "tomb": bool(st.get("tomb")), "d90": st.get("d90"), "up": st.get("up"), "rank": None, "known": op in stats}
    if len(out) < 0.8 * max(1, len(stats)): raise ValueError("only %d bonded validators read (the collector has %d)" % (len(out), len(stats)))
    return out

# ── strategies: the word the page wrote into the grant's memo ───────────────
PRESETS = {
    "passive":    {"every": 7 * 86400, "min_apr": 0.015, "min_atone": 5.0, "dests": 2, "d90": 99, "restake_every": 7 * 86400},
    "moderate":   {"every": 12 * 3600, "min_apr": 0.05,  "min_atone": 1.0, "dests": 5, "d90": 50, "restake_every": 86400},
    "aggressive": {"every": 3600,      "min_apr": 0.0025, "min_atone": 0.5, "dests": 8, "d90": 50, "restake_every": 12 * 3600},
    "picks":      {"every": 6 * 3600,  "min_apr": 0.005, "min_atone": 1.0, "dests": 5, "d90": 0, "restake_every": 86400},
}
# ── grants ─────────────────────────────────────────────────────────────────
def grants():
    out, key = [], None
    while True:
        q = "/cosmos/authz/v1beta1/grants/grantee/%s?pagination.limit=200" % GRANTEE + ("&pagination.key=%s" % urllib.parse.quote(key, safe="") if key else "")
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
ADMIN = os.environ.get("KEEPER_ADMIN", "/srv/atomone-app/state/admin-mainnet.json")
def admin():
    """what the operators decided in the admin console (adminapi writes it): pauses (Hold), approvals of a
    plan by its id (Apply), and every decision with who and when"""
    try: a = json.load(open(ADMIN))
    except Exception: a = {}
    for k in ("paused", "approved", "decisions"): a.setdefault(k, {})
    return a

def paused(): return set(admin()["paused"])

LEDGER = os.path.join(os.path.dirname(ADMIN), "grants-%s.json" % NET)
def granted_at(granter, c):
    """when the grant was made (grantwatch's ledger reads it from the grant's transaction), else when the
    keeper first saw it: the 48-hour clock starts here"""
    try:
        e = (json.load(open(LEDGER)).get("grants") or {}).get(granter) or {}
        if e.get("status") in ("new", "active", "expiring") and (e.get("made") or e.get("first_seen")):
            return int(e.get("made") or e["first_seen"])
    except Exception:
        pass
    return c.execute("SELECT min(at) FROM run_g WHERE granter=?", (granter,)).fetchone()[0] or int(time.time())

def plan_id(p):
    """a plan's identity: its moves exactly (source, destination, amount) - an approval is for these moves only"""
    if not p or not p.get("moves"): return None
    k = sorted((m["src"], m["dst"], int(m["amount"])) for m in p["moves"])
    return hashlib.sha1(json.dumps(k).encode()).hexdigest()[:12]

EMPTY_PID = plan_id({"moves": []})   # the id of "no moves": nothing for an operator to decide

def alert(level, title, text="", fields=None):
    log("alert", level, title)
    if notify:
        try: notify.send(level, title, text, fields, SITE + "/admin", net=NET)
        except Exception as e: log("alert failed: %s" % e)

def when(t): return time.strftime("%-d %b %H:%M UTC", time.gmtime(t))
def short(a): return a[:12] + "\u2026" + a[-6:]

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
        key = d.get("pagination", {}).get("next_key")
        if not key: break
    return {k: v for k, v in out.items() if v.get("claim") and v.get("stake")}

def plan_restake(c, granter, rg, vals, m, P):  # noqa: C901
    """what a restake would do now: claim the wallet's rewards (largest first) and stake them all on the best
    validator of the DELEGATE allow-list. Only grants to our own address count: any other authz grant the
    wallet made (restake bots, any validator's service, GATA's validator included) is foreign and ignored -
    GATA's validator is one validator like any other here."""
    last = c.execute("SELECT max(at) FROM restake WHERE granter=?", (granter,)).fetchone()[0] or 0
    if last >= slot0(): return {"skip": "not due"}
    wa = get("/cosmos/distribution/v1beta1/delegators/%s/withdraw_address" % granter).get("withdraw_address")
    if wa != granter: return {"skip": "rewards are paid to another address"}
    # the largest rewards first, at most MAX_CLAIM validators a transaction, and no more than
    # the DELEGATE cap can take back in: what is claimed is all staked, nothing left idle
    pend = []
    for r in get("/cosmos/distribution/v1beta1/delegators/%s/rewards" % granter).get("rewards", []):
        v = r["validator_address"]
        amt = sum(int(float(x["amount"])) for x in r.get("reward", []) if x.get("denom") == "uatone")
        if amt > 0: pend.append((amt, v))
    pend.sort(reverse=True)
    cap = rg["stake"]["cap"]
    rewards, claim = 0, []
    for amt, v in pend:
        if len(claim) >= MAX_CLAIM: break
        if cap is not None and claim and rewards + amt > cap: continue
        rewards += amt; claim.append(v)
    out = {"rewards": rewards, "pending_all": sum(a for a, _ in pend)}
    if rewards < MIN_RESTAKE * 1e6: out["skip"] = "below %g ATONE" % MIN_RESTAKE; return out
    send = 0   # GATA takes no share, ever: a restake stakes every claimed reward back, it never sends
    stake = rewards - send
    if cap is not None and stake > cap: out["skip"] = "delegate cap used up"; return out
    # where the rewards go (operator, 2026-09-30): all of them onto the ONE validator paying the highest APR once they
    # land, leaving out the last 3 of the active set (today: #97 of 100). An older DELEGATE grant that names validators
    # keeps to them
    allow = set(rg["stake"]["allow"] or [])
    ranked = sorted(vals.values(), key=lambda v: -v["t"])
    pool = [v for v in ranked[:max(0, len(ranked) - RS_EDGE)] if not allow or v["op"] in allow]
    if not pool or stake <= 0: out["skip"] = "no validator to stake on"; return out
    best = max(pool, key=lambda v: rate_after(m, v["t"], v["c"], int(stake)))
    legs = [{"validator": best["op"], "amount": int(stake)}]
    br = rate_after(m, vals[legs[0]["validator"]]["t"], vals[legs[0]["validator"]]["c"], legs[0]["amount"])
    out.update({"claim": claim, "stake": legs, "send": int(send), "rate": br,
                "fee_uphoton": int((120000 + 60000 * (len(claim) + 1 + len(legs))) * 0.25)})
    return out

def execute_restake(granter, p):
    body = {"granter": granter, "claim": p["claim"], "stake": [{"validator": s["validator"], "amount": str(s["amount"])} for s in p["stake"]], "memo": "GATA AtomOne Restake"}
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
            c.commit()
            # a failed restake alerts (it is tried again at the next 12-hour turn); while the signer is known to be
            # down its own alert covers every delegator, so no flood
            if not ok and not c.execute("SELECT 1 FROM alert_sent WHERE granter='_signer' AND k='down'").fetchone():
                alert("crit", "Restake failed: " + short(granter), "The keeper tries again at the next 12-hour turn.",
                      {"Delegator": granter, "Rewards": "{:,.4f} ATONE".format(p["rewards"] / 1e6), "Error": json.dumps(r.get("error"))[:300]})
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
        if amt <= 0: continue
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

# ── the plan: the operator's rule (2026-09-29) ────────────────────────────
# The smallest validator first (leaving out the last EDGE, the edge of the set): it takes as much as it can without passing the validator ranked just above
# it (so its rank never changes, and it stays the best payer); what is left goes to the next one up, same
# check; and so on, at most BOTTOM validators (1 to 34, as the amount needs). A source gives only what keeps
# it at or above the validator ranked just under it. Any validator of the active set may take stake. Nothing is offered while any of the delegator's stake cools down,
# so the offer comes back every 21 days, when the last move's cooldown clears.
# fixed in code, as the rest of the operator's rule: no env value can change them at launch
BOTTOM = 34
EDGE = 3            # the last 3 are left out (operator, 2026-09-30): destinations are ranks 67 to 97 of 100 (31 used)

def fill(ranked, stake, amount, ok):
    """the rule's pour: from the smallest up, each to 1 ATONE under the validator just above it (a tie
    would let the chain's tie-break swap the two, so the gap keeps the order strict); answers
    {op: added}. ranked is largest first; stake(op) the stake as it stands; ok(v) whether v may take any"""
    n = len(ranked); add = {}; left = amount
    # from rank n-EDGE (97 of 100) up to rank n-BOTTOM+1 (67): the last EDGE are left out
    for i in range(n - 1 - EDGE, max(-1, n - 1 - BOTTOM), -1):
        if left < 1_000_000: break
        v = ranked[i]
        if not ok(v): continue
        room = (stake(ranked[i - 1]["op"]) - stake(v["op"]) - 1_000_000) if i > 0 else left
        x = int(min(left, room))
        if x >= 1_000_000: add[v["op"]] = x; left -= x
    return add

def plan(g, rows, reds, vals, m, P=None, room=None):
    room = MAX_MOVES_DAY if room is None else room
    for r in rows:
        v = vals.get(r["op"])
        r["rate"] = rate_after(m, v["t"], v["c"], 0) if v else 0.0          # outside the set: earns nothing
        r["free"] = r["x"] - r["locked"]
    total = sum(r["x"] for r in rows)
    if room <= 0 or not total: return None
    # stake in its 21-day cooldown stays where it is; the free stake is hunted, all of it at once
    now = sum(r["x"] * r["rate"] for r in rows) / total
    ranked = sorted(vals.values(), key=lambda v: -v["t"]); n = len(ranked)
    if not n: return None
    pos_of = {v["op"]: i for i, v in enumerate(ranked)}
    bset = {v["op"] for v in ranked[max(0, n - BOTTOM):]}
    src = []
    for r in sorted((r for r in rows if r["free"] > 0 and r["op"] not in bset), key=lambda r: -r["free"]):
        if r["op"] in pos_of:
            i = pos_of[r["op"]]; under = ranked[i + 1]["t"] if i + 1 < n else 0
            give = min(r["free"], max(0, int(vals[r["op"]]["t"] - under - 1_000_000)))   # stays 1 ATONE above
        else:
            give = r["free"]
        if give >= 1_000_000: src.append({"op": r["op"], "give": give, "rate": r["rate"]})
    if not src: return None
    budget = sum(x["give"] for x in src)
    if g["cap"] is not None: budget = min(budget, g["cap"])
    gone = {x["op"]: x["give"] for x in src}          # the cautious bound: every source counted as gone
    def stake(op): return vals[op]["t"] - gone.get(op, 0)
    # any validator of the active set may take stake (operator, 2026-09-30): no uptime test, and a tombstoned validator
    # never returns to the set, so there is none to exclude; an older grant's validator list still binds
    def ok(v): return (g["allow"] is None or v["op"] in g["allow"]) and v["op"] not in g["deny"]
    used = pairs_used(reds)
    def moves_for(amount):
        add = fill(ranked, stake, amount, ok)
        # sources fill destinations in turn, smallest validator first: at most S + D - 1 moves, none on a pair
        # that already holds 7 unmatured entries
        out, si, left = [], 0, [dict(x) for x in src]
        for op in sorted(add, key=lambda o: -pos_of[o]):
            need = add[op]
            while need > 0 and si < len(left):
                s_ = left[si]; x = min(need, s_["give"])
                if x >= 1 and used.get((s_["op"], op), 0) < 7: out.append({"src": s_["op"], "dst": op, "amount": int(x)})
                s_["give"] -= x; need -= x
                if s_["give"] <= 0: si += 1
        return out
    # more moves than the day allows: move less, never cut a plan (a cut could leave a gap in the fill)
    moves = moves_for(budget)
    while len(moves) > room and budget > 1_000_000:
        budget = int(budget * 0.85); moves = moves_for(budget)
    if not moves or len(moves) > room: return None
    rate_src = {x["op"]: x["rate"] for x in src}
    def dst_rates(ms):
        mv_ = {}
        for x in ms: mv_[x["dst"]] = mv_.get(x["dst"], 0) + x["amount"]
        return {op: rate_after(m, vals[op]["t"], vals[op]["c"], a) for op, a in mv_.items()}
    # every move on its own must earn more than 5 APR points and carry at least 1 ATONE (audit 2026-09-30): a small
    # lift does not ride along on the average, and dust does not spend a pair entry. Dropping a move only fills less,
    # so no rank can change
    rate_dst = dst_rates(moves)
    moves = [x for x in moves if x["amount"] >= MIN_MOVE and rate_dst[x["dst"]] - rate_src[x["src"]] > MIN_GAIN_APR]
    if not moves: return None
    rate_dst = dst_rates(moves)
    for mv in moves: mv["gain"] = mv["amount"] * (rate_dst[mv["dst"]] - rate_src[mv["src"]]) / 1e6
    gain = sum(mv["gain"] for mv in moves)
    after = now + sum(mv["amount"] * (rate_dst[mv["dst"]] - rate_src[mv["src"]]) for mv in moves) / total
    moved_u = sum(mv["amount"] for mv in moves)
    lift = sum(mv["amount"] * (rate_dst[mv["dst"]] - rate_src[mv["src"]]) for mv in moves) / moved_u
    # only a move that earns the moved stake more than MIN_GAIN_APR (5 APR points): otherwise it is already at its best
    if gain < MIN_GAIN_ATONE or lift <= MIN_GAIN_APR: return None
    return {"moves": moves, "now": now, "after": after, "total": total, "gain": gain, "lift": lift}

# ── execution ──────────────────────────────────────────────────────────────
def execute(granter, moves):
    body = json.dumps({"granter": granter, "moves": [{"src": m["src"], "dst": m["dst"], "amount": str(int(m["amount"]))} for m in moves], "memo": "GATA AtomOne Autopilot"}).encode()
    req = urllib.request.Request(SIGNER, data=body, method="POST", headers={"content-type": "application/json", "x-gata-secret": SECRET})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        try: return {"error": json.load(e)}
        except Exception: return {"error": "HTTP %d" % e.code}
    except (urllib.error.URLError, OSError) as e:
        # the signer never answered: a timeout may still have broadcast, so the next try plans from the chain again
        return {"error": "network: %s" % e}

# ── a failed move: try again, or settle ────────────────────────────────────
# operator, 2026-09-30: a failure for a fee, network or RPC reason is tried again soon; a refusal by the chain's
# own rules (the stake is locked, a validator pair is full, the grant is gone or too small) is settled as done,
# and the next 12-hour run plans from the chain as it then stands. A tx that was sent but not yet seen is looked
# up by its hash before anything is tried again, so nothing is ever moved twice.
RETRY_WAITS = (600, 1800, 3600)          # 10 minutes, 30 minutes, an hour; then it waits for the next run
SETTLE_WORDS = ("redelegation", "transitive", "too many", "max entries", "no delegation", "delegation does not exist",
                "not enough delegation", "insufficient delegation", "invalid shares", "shares amount", "too few tokens",
                "truncates to zero", "validator does not exist", "no validator", "same validator", "authorization not found",
                "authorization expired", "failed to get grant", "insufficient amount", "more than", "exceeds",
                "daily move limit", "bad move", "bad granter")
RETRY_WORDS = ("fee", "gas", "sequence", "mempool", "tx already in", "timeout", "timed out", "network", "connect", "refused",
               "reset", "unreachable", "econn", "socket", "rpc", "fetch failed", "http 5", "insufficient funds", "unauthorized")
RETRY_CODES = {5, 11, 13, 19, 20, 32}    # the sdk codespace: fee payer short, out of gas, fee too low, in cache, mempool full, sequence

def classify(r):
    """what a failed execution means: ('retry' | 'settle' | 'pending', why, txhash)"""
    e = r.get("error"); d = e if isinstance(e, dict) else {}
    text = json.dumps(e).lower() if not isinstance(e, str) else e.lower()
    h = d.get("txhash") or r.get("txhash")
    m = re.search(r"\b([0-9A-F]{64})\b", json.dumps(e)) if not h else None
    if "not yet found" in text:
        return "pending", "sent, not yet seen on chain", h or (m.group(1) if m else None)
    why = (d.get("raw_log") or d.get("error") or (e if isinstance(e, str) else text))
    why = str(why)[:200]
    cm = re.search(r"code (\d+) \(codespace: (\w+)\)", text)
    if cm and cm.group(2) == "sdk" and int(cm.group(1)) in RETRY_CODES: return "retry", why, h
    if any(w in text for w in SETTLE_WORDS): return "settle", why, h
    if any(w in text for w in RETRY_WORDS): return "retry", why, h
    return "retry", why, h                # unknown: tried a few times, then it waits for the next run

def tx_on_chain(h):
    """the tx by hash: its result code, or None when the chain does not have it"""
    try: t = get("/cosmos/tx/v1beta1/txs/" + h).get("tx_response") or {}
    except urllib.error.HTTPError as e:
        if e.code in (400, 404): return None
        raise
    return int(t.get("code", 0)), t.get("raw_log", "")

def moves_today(c, granter):
    return c.execute("SELECT count(*) FROM move WHERE granter=? AND at>? AND dry=0", (granter, int(time.time()) - 86400)).fetchone()[0]

def report(granter, obj):
    os.makedirs(REPORTS, exist_ok=True)
    tmp = os.path.join(REPORTS, granter + ".json.tmp")
    json.dump(obj, open(tmp, "w")); os.replace(tmp, os.path.join(REPORTS, granter + ".json"))

def sent(c, gr, key):
    """has this alert gone out already? (and mark it)"""
    if c.execute("SELECT 1 FROM alert_sent WHERE granter=? AND k=?", (gr, key)).fetchone(): return True
    c.execute("INSERT INTO alert_sent VALUES(?,?,?)", (gr, key, int(time.time()))); c.commit(); return False

def plan_fields(gr, p):
    f = {"Delegator": gr}
    if p and p.get("moves"):
        f["Moves"] = "%d, %s ATONE" % (len(p["moves"]), "{:,.1f}".format(sum(int(m["amount"]) for m in p["moves"]) / 1e6))
        f["Gain"] = "+%s ATONE a year" % "{:,.1f}".format(p.get("gain") or 0)
        if p.get("now") is not None: f["APR"] = "%.1f%% to %.1f%%" % (p["now"] * 100, p["after"] * 100)
    else:
        f["Moves"] = "none: the stake already sits well"
    return f

def carry_out(c, g, p, pid, ap, dry, out):
    """execute the approved plan (or, in dry run, record it as applied and sign nothing), then announce it"""
    gr, now = g["granter"], int(time.time())
    f = plan_fields(gr, p); f["Approved by"] = ap.get("by") or "an operator"
    if dry:
        for e in p["moves"]:
            c.execute("INSERT INTO move VALUES(?,?,?,?,?,?,?,?)", (now, gr, e["src"], e["dst"], int(e["amount"]), e["gain"], None, 1))
        c.execute("INSERT INTO applied VALUES(?,?,?,?,?,?,?,?,?)", (now, gr, pid, ap.get("by"), None, 1, 1, None, ap.get("at"))); c.commit()
        log("DRY applied granter=%s plan=%s" % (gr, pid))
        alert("ok", "Autopilot strategy applied: " + short(gr), "Dry run: the keeper recorded the approved moves and signed nothing.", f)
        return
    if moves_today(c, gr) + len(p["moves"]) > MAX_MOVES_DAY:
        r = {"error": "daily move limit (%d) reached" % MAX_MOVES_DAY}
    else:
        r = execute(gr, p["moves"])
    ok = "txhash" in r and "error" not in r
    if ok:
        for e in p["moves"]:
            c.execute("INSERT INTO move VALUES(?,?,?,?,?,?,?,?)", (now, gr, e["src"], e["dst"], int(e["amount"]), e["gain"], r.get("txhash"), 0))
    c.execute("INSERT INTO applied VALUES(?,?,?,?,?,?,?,?,?)", (now, gr, pid, ap.get("by"), r.get("txhash") if ok else None, 0, 1 if ok else 0, None if ok else json.dumps(r.get("error"))[:300], ap.get("at")))
    c.commit(); out["last"] = r
    log("exec granter=%s plan=%s -> %s" % (gr, pid, r))
    if ok:
        f["Tx"] = r.get("txhash", "")
        alert("ok", "Autopilot strategy applied: " + short(gr), "The approved moves are on chain.", f)
    else:
        f["Error"] = json.dumps(r.get("error"))[:300]
        alert("crit", "Autopilot move failed: " + short(gr), "The approved plan could not be carried out. The keeper tries again in an hour.", f)

def auto_apply(c, g, p, pid, dry, out):
    """carry out a plan in the run that made it (no operator step since 2026-09-30), then announce it"""
    gr, now = g["granter"], int(time.time())
    f = plan_fields(gr, p)
    if dry:
        for e in p["moves"]:
            c.execute("INSERT INTO move VALUES(?,?,?,?,?,?,?,?)", (now, gr, e["src"], e["dst"], int(e["amount"]), e["gain"], None, 1))
        c.execute("INSERT INTO applied VALUES(?,?,?,?,?,?,?,?,?)", (now, gr, pid, "auto", None, 1, 1, None, 0)); c.commit()
        log("DRY auto granter=%s plan=%s" % (gr, pid))
        return
    if moves_today(c, gr) + len(p["moves"]) > MAX_MOVES_DAY:
        r = {"error": "daily move limit (%d) reached" % MAX_MOVES_DAY}
    else:
        r = execute(gr, p["moves"])
    ok = "txhash" in r and "error" not in r
    kind, why, h = ("ok", "", r.get("txhash")) if ok else classify(r)
    if ok: record_moves(c, gr, p["moves"], r.get("txhash"), now)
    c.execute("INSERT INTO applied VALUES(?,?,?,?,?,?,?,?,?)", (now, gr, pid, "auto", r.get("txhash") if ok else None, 0, 1 if ok else 0,
              None if ok else ("%s: %s" % ("settled" if kind == "settle" else "will retry", json.dumps(r.get("error"))))[:300], 0))
    c.commit(); out["last"] = r
    log("auto exec granter=%s plan=%s -> %s (%s)" % (gr, pid, r, kind))
    if ok:
        c.execute("DELETE FROM retry WHERE granter=?", (gr,)); c.commit()
        f["Tx"] = r.get("txhash", "")
        alert("ok", "Autopilot moved: " + short(gr), "The moves are on chain.", f)
    elif kind == "settle":
        c.execute("DELETE FROM retry WHERE granter=?", (gr,)); c.commit()
        f["Chain said"] = why
        alert("info", "Autopilot move settled: " + short(gr), "The chain's own rules stop this move (a lock, a full pair or the grant). "
              "Nothing to fix: the next run in 12 hours plans from the chain as it then stands.", f)
    else:
        schedule_retry(c, gr, kind, why, h, p["moves"], f)

def record_moves(c, gr, moves, txhash, at):
    for e in moves:
        c.execute("INSERT INTO move VALUES(?,?,?,?,?,?,?,?)", (at, gr, e["src"], e["dst"], int(e["amount"]), e.get("gain", 0), txhash, 0))

def schedule_retry(c, gr, kind, why, h, moves, f):
    """a fee, network or RPC failure (or a tx not yet seen): try again after the next wait, or give up to the next run"""
    row = c.execute("SELECT tries, since FROM retry WHERE granter=?", (gr,)).fetchone()
    tries, since = (row[0] + 1, row[1]) if row else (1, int(time.time()))
    f["Reason"] = why
    if tries > len(RETRY_WAITS):
        c.execute("DELETE FROM retry WHERE granter=?", (gr,)); c.commit()
        alert("crit", "Autopilot move failed %d times: %s" % (tries, short(gr)), "A fee, network or RPC problem that did not clear "
              "in %d tries. Check the signer, its PHOTON and the RPCs; the next run in 12 hours tries again." % tries, f)
        return
    wait = RETRY_WAITS[0] if kind == "pending" else RETRY_WAITS[tries - 1]     # a tx not yet seen is looked up soon
    c.execute("INSERT OR REPLACE INTO retry VALUES(?,?,?,?,?,?,?)", (gr, int(time.time()) + wait, tries, why, h if kind == "pending" else None,
              json.dumps([{"src": e["src"], "dst": e["dst"], "amount": int(e["amount"]), "gain": e.get("gain", 0)} for e in moves]), since))
    c.commit()
    if tries == 1:
        alert("warn", "Autopilot move failed, trying again: " + short(gr), ("Sent, not yet seen on chain: the keeper looks it up by hash"
              if kind == "pending" else "A fee, network or RPC problem: the keeper tries again") + " in %d minutes." % (wait // 60), f)

def landed_since(gr, since, h=None):
    """an Autopilot tx for this wallet that landed at or after `since`: {"txhash", "moves", "code"}; None when there is none;
    "unknown" when the chain cannot be asked (then nothing is replanned - a lagging node must not cause a second move)"""
    try:
        if h:
            r = tx_on_chain(h)
            if r is not None:
                t = get("/cosmos/tx/v1beta1/txs/" + h).get("tx_response") or {}
                return {"txhash": h, "code": r[0], "raw": r[1], "moves": _tx_moves(t, gr)}
        d = get("/cosmos/tx/v1beta1/txs?query=" + urllib.parse.quote("message.sender='%s'" % GRANTEE) + "&order_by=ORDER_BY_DESC&pagination.limit=30")
    except Exception as e:
        log("landed lookup for %s failed: %s" % (gr, e)); return "unknown"
    import datetime
    for t in d.get("tx_responses", []) or []:
        try: ts = datetime.datetime.fromisoformat(t["timestamp"].replace("Z", "+00:00")).timestamp()
        except Exception: continue
        if ts < since - 5: break
        mv = _tx_moves(t, gr)
        if mv and int(t.get("code", 0)) == 0: return {"txhash": t["txhash"], "code": 0, "raw": "", "moves": mv}
    return None

def _tx_moves(t, gr):
    out = []
    for m in (((t.get("tx") or {}).get("body") or {}).get("messages") or []):
        for x in m.get("msgs", []) or []:
            if x.get("delegator_address") == gr and x.get("@type", "").endswith("MsgBeginRedelegate"):
                out.append({"src": x["validator_src_address"], "dst": x["validator_dst_address"], "amount": int(x["amount"]["amount"]), "gain": 0})
    return out

def settle_landed(c, gr, seen):
    """a move found on chain after a failure: recorded as the move when it succeeded; either way the retry is over"""
    now = int(time.time())
    if seen["code"] == 0 and seen["moves"] and not c.execute("SELECT 1 FROM move WHERE txhash=?", (seen["txhash"],)).fetchone():
        record_moves(c, gr, seen["moves"], seen["txhash"], now)
        c.execute("INSERT INTO applied VALUES(?,?,?,?,?,?,?,?,?)", (now, gr, plan_id({"moves": seen["moves"]}), "auto", seen["txhash"], 0, 1, None, 0))
        alert("ok", "Autopilot moved: " + short(gr), "The moves landed after a slow answer.", {"Delegator": gr, "Tx": seen["txhash"]})
    elif seen["code"] != 0:
        log("tx %s for %s landed with code %s: %s" % (seen["txhash"], gr, seen["code"], str(seen.get("raw"))[:200]))
    c.execute("DELETE FROM retry WHERE granter=?", (gr,)); c.commit()

def gate(c, g, p, pid, adm, dry):
    """The admin gate for one Autopilot delegator. Nothing moves unless an operator approved exactly this
    plan (by its id). Every grant waits for an operator first (activation), and every later plan that
    differs from what was decided waits again. The clock is 48 hours; alerts at 3 hours left and every
    12 hours once overdue - never an automatic apply. Returns the report's 'admin' block."""
    gr, now = g["granter"], int(time.time())
    made = granted_at(gr, c)
    decs = [d for d in adm["decisions"].get(gr, []) if d.get("at", 0) >= made]
    decided = {d.get("plan_id") for d in decs if d.get("action") in ("apply", "nomove")}
    ap = adm["approved"].get(gr)
    if ap and ap.get("at", 0) < made: ap = None
    held = gr in adm["paused"]
    out = {"plan_id": pid, "made": made, "decisions": decs[-10:]}
    # an approval not yet carried out
    todo = ap and not c.execute("SELECT 1 FROM applied WHERE granter=? AND plan_id=? AND ok=1 AND ap_at=?", (gr, ap["plan_id"], ap["at"])).fetchone()
    if todo and not held:
        if ap["plan_id"] == pid and p:
            tried = c.execute("SELECT max(at) FROM applied WHERE granter=? AND plan_id=? AND ok=0 AND ap_at=?", (gr, pid, ap["at"])).fetchone()[0] or 0
            if now - tried >= RETRY_S: carry_out(c, g, p, pid, ap, dry, out)
        elif p is not None and ap["plan_id"] != pid and not sent(c, gr, "changed:" + ap["plan_id"]):
            alert("warn", "Autopilot plan changed, approve again: " + short(gr),
                  "The stake changed after the operator approved, so those moves no longer apply. Review the new plan.", {"Delegator": gr, "Approved by": ap.get("by", "")})
    todo = ap and not c.execute("SELECT 1 FROM applied WHERE granter=? AND plan_id=? AND ok=1 AND ap_at=?", (gr, ap["plan_id"], ap["at"])).fetchone()
    # what, if anything, waits for an operator
    row = c.execute("SELECT plan_id, reason, since FROM pend WHERE granter=?", (gr,)).fetchone()
    reason = None
    if held: state = "held"
    elif todo and ap["plan_id"] == pid: state = "approved"
    elif pid == EMPTY_PID:
        # nothing to offer (the stake is cooling down, or already in place): nothing waits for an operator and
        # no clock runs; the first offer comes when the cooldown clears (operator, 2026-09-29)
        state = "managed"
    else:
        if not decs: reason = "activation"
        elif pid and pid not in decided: reason = "new plan"
        state = "waiting" if reason else "managed"
    if reason:
        since = row[2] if row else (made if reason == "activation" else now)
        dl = since + SLA_S
        c.execute("INSERT INTO pend VALUES(?,?,?,?,?,0,0,'') ON CONFLICT(granter) DO UPDATE SET plan_id=excluded.plan_id, reason=excluded.reason, since=excluded.since, deadline=excluded.deadline",
                  (gr, pid, reason, since, dl)); c.commit()
        out.update({"reason": reason, "since": since, "deadline": dl})
        f = plan_fields(gr, p) if p is not None else {"Delegator": gr}
        f["Decide by"] = when(dl)
        if p is not None and not sent(c, gr, "ready:%d:%s" % (since, pid)):
            alert("info", ("New Autopilot plan: " if reason == "new plan" else "Autopilot plan ready: ") + short(gr),
                  "An operator answers it in the admin console: Yes (the keeper makes it) or No (settled by hand).", f)
        if dl - WARN_S <= now < dl and not sent(c, gr, "warn:%d" % since):
            alert("warn", "Autopilot: 3 hours left for " + short(gr), "No operator has decided on this delegator's plan yet.", f)
        if now >= dl and not sent(c, gr, "over:%d:%d" % (since, (now - dl) // OVERDUE_EVERY)):
            alert("crit", "Autopilot overdue: " + short(gr), "48 hours passed with no decision. Nothing moves until an operator acts.", f)
    else:
        c.execute("DELETE FROM pend WHERE granter=?", (gr,)); c.commit()
    out["state"] = state
    last = c.execute("SELECT at, plan_id, by, txhash, dry, ok, error FROM applied WHERE granter=? AND at>=? ORDER BY at DESC, rowid DESC LIMIT 1", (gr, made)).fetchone()
    if last: out["applied"] = {"at": last[0], "plan_id": last[1], "by": last[2], "txhash": last[3], "dry": bool(last[4]), "ok": bool(last[5]), "error": last[6]}
    return out

def once(c, only=None, live=None, force=False):
    """One tick. Each delegator is planned at the fixed pace (every 6 hours), at once when new, and at once
    when an operator's approval waits to be carried out; the admin gate runs every tick. only=<granter>
    restricts it; live overrides KEEPER_DRY for this tick; force plans now."""
    dry = DRY if live is None else (not live)
    fresh()
    vals, m, eta = model()
    # the set as the chain has it now (not the 15-minute collect): anything already executed is simply there
    # no silent fallback to the collector's stakes: a tick without the live set does nothing
    vals = live_vals(vals)
    # first come, first served (operator, 2026-09-29): grants are planned in the order they were made, and each
    # plan that stands (waiting for an operator, approved, or carried out this tick) is counted as placed before
    # the next grant is planned - the first grantee gets the top strategy, the next one the next best
    work = {op: dict(v) for op, v in vals.items()}
    def claim(moves):
        for mv in moves or []:
            amt = mv.get("uatone", mv.get("amount", 0))
            if mv["src"] in work: work[mv["src"]]["t"] -= amt
            if mv["dst"] in work: work[mv["dst"]]["t"] += amt
    tick0 = int(time.time())
    gs = [g for g in grants() if not only or g["granter"] == only]; acted = 0
    gs.sort(key=lambda g: granted_at(g["granter"], c))
    try: rgs = restake_grants()
    except Exception as e: rgs = {}; log("restake grants unreadable: %s" % e)
    adm = admin()
    for g in gs:
        gr = g["granter"]
        try:
            # no strategies: one fixed rule for every Autopilot (the former moderate); an operator decides on each plan
            name = "moderate"; P = PRESETS[name]
            path = os.path.join(REPORTS, gr + ".json")
            try: prev = json.load(open(path))
            except Exception: prev = None
            last = c.execute("SELECT max(at) FROM run_g WHERE granter=?", (gr,)).fetchone()[0] or 0
            # the grant as it stands: a re-grant (Change, a new cap or validator list) is planned at once, not
            # at the next 6-hour turn, so the console never shows a plan made for the grant it replaced
            gsig = hashlib.sha1(json.dumps([g["cap"], sorted(g["allow"] or []), g["exp"]]).encode()).hexdigest()[:12]
            due = force or not last or last < slot0() or (prev or {}).get("grant_sig") != gsig
            # a move that failed for a fee, network or RPC reason is tried again at its time; one that was sent but not
            # seen is looked up by hash first, and if it landed that is the move - nothing is planned over it
            rt = c.execute("SELECT due, tries, txhash, moves, since FROM retry WHERE granter=?", (gr,)).fetchone()
            if rt and rt[0] <= time.time():
                # before anything is planned again, the chain is asked whether a move for this wallet landed since the first
                # failure (a slow answer, a timeout, a tx still travelling): landed = that is the move; the chain cannot
                # say = wait; a tx sent and not yet seen is given 30 minutes before it counts as gone (audit, 2026-09-30)
                seen = landed_since(gr, rt[4] or 0, rt[2])
                if seen == "unknown": due = False
                elif seen:
                    settle_landed(c, gr, seen); due = False
                elif rt[2] and time.time() - (rt[4] or 0) < 1800: due = False
                else: due = True
            if gr in adm["paused"]: due = False
            p = None
            if due:
                rows, reds = position(gr, work)
                p = plan(g, rows, reds, work, m, P, room=MAX_MOVES_DAY - moves_today(c, gr)) or {"moves": []}
                c.execute("INSERT INTO run_g VALUES(?,?)", (int(time.time()), gr)); c.commit()
                record = rate_record(c, gr, rows)
                rep = {"granter": gr, "checked": int(time.time()), "dry": dry, "strategy": name,
                       "grant": {"cap": g["cap"], "allow": len(g["allow"]) if g["allow"] else None, "expires": g["exp"]}, "grant_sig": gsig,
                       "staked": sum(r["x"] for r in rows), "now": p.get("now"), "after": p.get("after"), "gain": p.get("gain"),
                       "moves": [{"src": e["src"], "dst": e["dst"], "uatone": e["amount"], "gain": round(e["gain"], 3)} for e in p["moves"]], "last": None}
                if record: rep["record"] = record
                if prev and prev.get("restake"): rep["restake"] = prev["restake"]
                pid = plan_id(p)
                if p["moves"]: log("granter=%s plan %s: %d moves, +%.1f ATONE a year" % (gr, pid, len(p["moves"]), p["gain"]))
            else:
                rep = prev or {"granter": gr, "strategy": name, "moves": []}
                pid = (rep.get("admin") or {}).get("plan_id")
            # no approval (operator, 2026-09-30): a plan is carried out in the run that makes it. Hold (the console's
            # emergency stop) still stops everything for a delegator
            if due and p and p["moves"] and gr not in adm["paused"]:
                auto_apply(c, g, p, pid, dry, rep)
            elif due and p is not None and not p["moves"]:
                c.execute("DELETE FROM retry WHERE granter=?", (gr,)); c.commit()     # nothing left to move: nothing to retry
            # the history after this run's move, so a move made now is in the report now (a grant it used up gets no later run)
            hist = c.execute("SELECT at, src, dst, uatone, gain, txhash FROM move WHERE granter=? AND dry=0 ORDER BY at DESC LIMIT 10", (gr,)).fetchall()
            rep["history"] = [{"at": h[0], "src": h[1], "dst": h[2], "uatone": h[3], "gain": h[4], "txhash": h[5]} for h in hist]
            last = c.execute("SELECT at, plan_id, by, txhash, dry, ok, error FROM applied WHERE granter=? ORDER BY at DESC, rowid DESC LIMIT 1", (gr,)).fetchone()
            rep["admin"] = {"state": "held" if gr in adm["paused"] else "auto", "plan_id": pid}
            if last: rep["admin"]["applied"] = {"at": last[0], "plan_id": last[1], "by": last[2], "txhash": last[3], "dry": bool(last[4]), "ok": bool(last[5]), "error": last[6]}
            ad_ = rep["admin"]
            if due and p is not None and (ad_.get("applied") or {}).get("at", 0) >= tick0 and (ad_.get("applied") or {}).get("ok"):
                claim(rep.get("moves"))          # a plan made this tick; a move found on chain is in the live set already
            if rep["admin"].get("applied", {}).get("at", 0) >= int(time.time()) - TICK: acted += 1
            rep["dry"] = dry
            report(gr, rep)
        except Exception as e:
            log("granter %s failed: %s" % (gr, e))
    # nothing waits for a delegator who is no longer an Autopilot granter (revoked, used up)
    live_gs = {g["granter"] for g in gs}
    if not only:
        for (gr,) in c.execute("SELECT granter FROM pend").fetchall():
            if gr not in live_gs: c.execute("DELETE FROM pend WHERE granter=?", (gr,))
        c.commit()
    # restake, its own service with fixed rules - the same for everyone, Autopilot or not: every 12 hours, from
    # 1 ATONE of rewards, staked on the best-paying validator the wallet's delegate grant allows (its own), under the
    # usual checks (withdraw address, other services, the cap, the dry switch, an admin pause). No admin step.
    RS_FIXED = {"restake_every": 12 * 3600, "d90": 0}
    for granter in rgs:
        if only and granter != only: continue
        try:
            if granter in adm["paused"]: continue
            seen = c.execute("SELECT at FROM rs_run WHERE granter=?", (granter,)).fetchone()
            if not force and seen and seen[0] >= slot0(): continue
            c.execute("INSERT INTO rs_run VALUES(?,?) ON CONFLICT(granter) DO UPDATE SET at=excluded.at", (granter, int(time.time()))); c.commit()
            rs = restake_step(c, granter, rgs, work, m, RS_FIXED, dry)
            # the next restake (and the next tick's plans) see these stakes where they land
            for leg in ((rs or {}).get("stake") or []):
                if leg.get("validator") in work: work[leg["validator"]]["t"] += int(leg.get("amount", 0))
            path = os.path.join(REPORTS, granter + ".json")
            try: rep = json.load(open(path))
            except Exception: rep = {"granter": granter, "strategy": "restake"}
            rep["checked"] = int(time.time()); rep["dry"] = dry; rep["restake"] = rs or {}
            report(granter, rep)
        except Exception as e:
            log("restake granter %s failed: %s" % (granter, e))
    c.execute("INSERT INTO run VALUES(?,?,?,?)", (int(time.time()), len(gs), acted, "dry" if dry else "live")); c.commit()
    # the signer's own standing, for the page
    try:
        s = get("/cosmos/bank/v1beta1/balances/%s" % GRANTEE)
        photon = next((int(b["amount"]) for b in s.get("balances", []) if b["denom"] == "uphoton"), 0)
        report("_status", {"grantee": GRANTEE, "checked": int(time.time()), "grants": len(gs), "dry": DRY, "photon": photon, "every": EVERY})
        low_photon(c, photon)
    except Exception as e:
        log("status failed: %s" % e)
    try:
        signer_health(c)
    except Exception as e:
        log("status failed: %s" % e)

SIGNER_FAILS = [0]                               # consecutive ticks the signer did not answer
def signer_health(c):
    """every tick: the signer answers /whoami with our address. Three missed ticks in a row -> Discord (again every
    6 hours while it stays down); a wrong address -> Discord at once; back -> Discord once."""
    now, url = int(time.time()), SIGNER.rsplit("/", 1)[0] + "/whoami"
    try:
        req = urllib.request.Request(url, headers={"x-gata-secret": SECRET})
        with urllib.request.urlopen(req, timeout=15) as r: who = json.load(r).get("address")
        err = None if who == GRANTEE else "it signs as %s, not %s" % (who, GRANTEE)
    except Exception as e:
        err = "no answer: %s" % (str(e)[:200])
    row = c.execute("SELECT at FROM alert_sent WHERE granter='_signer' AND k='down'").fetchone()
    if err:
        SIGNER_FAILS[0] += 1
        if (SIGNER_FAILS[0] >= 3 or "signs as" in err) and (not row or now - row[0] >= 6 * 3600):
            alert("crit", "Autopilot signer not answering", "Moves and restakes cannot be signed until it is back.", {"Signer": url, "Problem": err})
            c.execute("INSERT OR REPLACE INTO alert_sent VALUES('_signer', 'down', ?)", (now,)); c.commit()
    else:
        SIGNER_FAILS[0] = 0
        if row:
            alert("ok", "Autopilot signer back", "", {"Signer": url})
            c.execute("DELETE FROM alert_sent WHERE granter='_signer' AND k='down'"); c.commit()

LOW_PHOTON = int(float(os.environ.get("KEEPER_LOW_PHOTON", "15")) * 1e6)   # the signer pays every fee in PHOTON
def low_photon(c, photon):
    """Discord when the signer's PHOTON falls below LOW_PHOTON: once on the way down, again every 24 hours while
    it stays low, and once when it is funded back above. One marker row ('_signer', 'low') exists while it is low."""
    now = int(time.time())
    row = c.execute("SELECT at FROM alert_sent WHERE granter='_signer' AND k='low'").fetchone()
    f = {"Signer": GRANTEE, "Balance": "{:,.2f} PHOTON".format(photon / 1e6), "Alert below": "{:,.0f} PHOTON".format(LOW_PHOTON / 1e6)}
    if photon < LOW_PHOTON:
        if not row or now - row[0] >= 86400:
            alert("warn", "Autopilot signer low on PHOTON: {:,.2f} left".format(photon / 1e6),
                  "The signer pays every move and restake fee in PHOTON. Send PHOTON to its address.", f)
            c.execute("INSERT OR REPLACE INTO alert_sent VALUES('_signer', 'low', ?)", (now,)); c.commit()
    elif row:
        alert("ok", "Autopilot signer PHOTON funded: {:,.2f}".format(photon / 1e6), "", f)
        c.execute("DELETE FROM alert_sent WHERE granter='_signer' AND k='low'"); c.commit()

def main():
    """Service: a tick every KEEPER_TICK (60 s); each delegator planned every 6 hours, at once when new or
    approved. By hand:  keeper.py --once [--granter atone1...] [--live] [--force]
              --once   one tick, then exit (respects KEEPER_DRY unless --live)
              --live   execute approved plans for real on this tick only
              --force  plan now even if not due"""
    if not GRANTEE or not SIGNER or not SECRET:
        log("not configured (KEEPER_GRANTEE / KEEPER_SIGNER_URL / KEEPER_SECRET) - parking"); sys.exit(78)
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    # one keeper per state at a time: a hand run beside the service would execute the same plan twice (audit, 2026-09-30)
    import fcntl
    lk = open(STATE + ".lock", "w")
    try: fcntl.flock(lk, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError: log("another keeper holds %s - not starting" % STATE); sys.exit(75)
    c = db(); a = sys.argv[1:]
    if "--once" in a:
        only = a[a.index("--granter") + 1] if "--granter" in a else None
        once(c, only=only, live=True if "--live" in a else None, force="--force" in a); return
    n = 0
    while True:
        try: once(c)
        except Exception as e:
            log("run failed: %s" % e); n += 1
            if n == 10 or (n > 10 and n % 360 == 0): alert("warn", "Autopilot keeper cannot run", str(e)[:300])   # again every 6 hours
        else: n = 0
        time.sleep(TICK)

if __name__ == "__main__": main()
