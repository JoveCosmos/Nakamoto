#!/usr/bin/env python3
"""GATA autopilot keeper - runs on the app box, holds NO key.

Every KEEPER_TICK (60 s) it reads, from the chain, every StakeAuthorization REDELEGATE
grant made to the signer's address. Each granter is planned once per 12-hour slot, at 00:00
and 12:00 UTC (at once when the grant is new or changed): would moving some of their stake
earn them more - the same arithmetic the page uses (ADR-004: rate = (1 - c) * (a + b / (t + x))
with the live eta)? A plan is carried out in the run that makes it (no approval step since
2026-09-30): the remote signer (its own key) executes MsgExec{MsgBeginRedelegate...}. Restake
runs in the same slots. Disable in the admin console stops both for a wallet until Enable.
The chain enforces the grant's allow-list and cap, and the signer its own policy (the same
window, a daily cap), on top of everything here.

What this will never do: move stake that is still in its 21-day cooldown, move to a
validator outside the rule's window or the grant's allow-list, exceed the grant's
remaining cap, make more than MAX_MOVES_DAY moves for one granter in a day, move a
Disabled wallet, or sign anything while KEEPER_DRY=1 (a plan is then recorded, dry).

State: /srv/atomone-app/keeper/state/keeper.db (sqlite: runs, moves); KEEPER_STATE overrides.
Report per granter: /srv/atomone-app/web/keeper/<granter>.json (the page shows it); KEEPER_REPORTS.
Testnet: the same code under atomone-app-keeper-testnet with KEEPER_DATA/STATE/REPORTS/ADMIN
and ATOMONE_API pointed at testnet.
"""
import calendar, hashlib, json, os, re, sqlite3, sys, time, urllib.request, urllib.error, urllib.parse

# Discord, through the app's one sender (bin/notify.py; the webhook comes from the unit's alerts env)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "bin"))
try:
    import notify
except Exception:                                   # no sender: alerts are logged, never fatal
    notify = None

API = os.environ.get("ATOMONE_API", "https://atomone-api.gatadao.com")
SIGNER = os.environ.get("KEEPER_SIGNER_URL", "")
def _secret():
    """the signer's shared secret: the unit's systemd credential when it loads one, else KEEPER_SECRET from the env
    (audit 2026-09-30: as a credential only the keeper process can read it)"""
    d = os.environ.get("CREDENTIALS_DIRECTORY")
    if d and os.path.exists(os.path.join(d, "keeper_secret")):
        with open(os.path.join(d, "keeper_secret")) as f: return f.read().strip()
    return os.environ.get("KEEPER_SECRET", "")
SECRET = _secret()
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
MAX_MOVES_DAY = 60            # per wallet in any 24 hours (operator, 2026-10-01: a large wallet finishes in one run); the signer's MAX_MOVES_DAY
MAX_MOVES_TX = 60             # per transaction (operator, 2026-10-01: one transaction, ~20M gas of the block's 100M); the signer's MAX_MOVES
RS_EDGE = 3                   # restake: the last 3 of the set are left out of the highest-APR pick (the signer's RS_EDGE)
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
NET = os.environ.get("NET", "mainnet")
SITE = os.environ.get("SITE_URL", "https://atomone.gatahub.zone")
TICK = int(os.environ.get("KEEPER_TICK", "60"))           # the loop: new grants and retries are picked up this fast
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
    # fee_ledger and pend are approval-era tables, no longer read or written; kept so every old state opens as it was
    c.execute("CREATE TABLE IF NOT EXISTS fee_ledger(granter TEXT PRIMARY KEY, earned INT, collected INT, updated INT)")
    c.execute("CREATE TABLE IF NOT EXISTS pend(granter TEXT PRIMARY KEY, plan_id TEXT, reason TEXT, since INT, deadline INT, warned INT, overdue_at INT, ready_sent TEXT)")
    # every plan carried out (by "auto"), ok or not
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

def grant_sig(g):
    """the grant's identity for "changed": its validator list and expiry. Not the cap: the chain lowers max_tokens on
    every move, so a capped grant would look new every tick (audit 2026-09-30)"""
    return hashlib.sha1(json.dumps([sorted(g["allow"] or []), g["exp"]]).encode()).hexdigest()[:12]

def grant_changed(g, prev):
    """a re-grant since the last report: another list or expiry, a cap that rose (falling is the chain spending it),
    or a cap added or removed. A report written before 2026-09-30 carries the old sig (cap, list, expiry), read too"""
    if not prev: return True
    pg = prev.get("grant") or {}; pcap = pg.get("cap"); ps = prev.get("grant_sig")
    old = hashlib.sha1(json.dumps([pcap, sorted(g["allow"] or []), g["exp"]]).encode()).hexdigest()[:12]
    if ps not in (grant_sig(g), old): return True
    if (g["cap"] is None) != (pcap is None): return True
    return g["cap"] is not None and g["cap"] > pcap

# ── restake ────────────────────────────────────────────────────────────────
ADMIN = os.environ.get("KEEPER_ADMIN", "/srv/atomone-app/state/admin-mainnet.json")
def admin():
    """what the operators decided in the admin console (adminapi writes it): the Disabled wallets ("paused").
    No file yet is a first run (nothing Disabled); a file that exists and does not parse raises, so the tick is
    skipped and "cannot run" alerts - never read as empty, which would re-enable every Disabled wallet (audit 2026-09-30)"""
    try: f = open(ADMIN)
    except FileNotFoundError: return {"paused": {}}
    with f: a = json.load(f)
    if not isinstance(a, dict) or not isinstance(a.setdefault("paused", {}), (dict, list)):
        raise ValueError("admin state %s is not what adminapi writes" % ADMIN)
    return a

LEDGER = os.path.join(os.path.dirname(ADMIN), "grants-%s.json" % NET)
def granted_at(granter, c):
    """when the grant was made (grantwatch's ledger reads it from the grant's transaction), else when the
    keeper first saw it: grants are planned in this order"""
    try:
        e = (json.load(open(LEDGER)).get("grants") or {}).get(granter) or {}
        if e.get("status") in ("new", "active", "expiring") and (e.get("made") or e.get("first_seen")):
            return int(e.get("made") or e["first_seen"])
    except Exception:
        pass
    return c.execute("SELECT min(at) FROM run_g WHERE granter=?", (granter,)).fetchone()[0] or int(time.time())

def plan_id(p):
    """a plan's identity: its moves exactly (source, destination, amount), as the report and the applied table name it"""
    if not p or not p.get("moves"): return None
    k = sorted((m["src"], m["dst"], int(m["amount"])) for m in p["moves"])
    return hashlib.sha1(json.dumps(k).encode()).hexdigest()[:12]

def alert(level, title, text="", fields=None):
    """operational: the ops Telegram (notify.ops); business events go through discord()"""
    log("alert", level, title)
    if notify:
        try: notify.send(level, title, text, fields, SITE + "/admin", net=NET)
        except Exception as e: log("alert failed: %s" % e)

def short(a): return a[:12] + "\u2026" + a[-6:]

# ── Discord (operator, 2026-10-01): business events only, the network first in every title ──────────────────────────
def discord(level, title, text="", fields=None):
    try: return notify.discord(NET, level, title, text, fields, SITE + "/admin")
    except Exception as e: log("discord failed: %s" % e)

# what one tick did, for the run summaries: Autopilot and Restake each announce their scheduled run (00:00, 12:00 UTC)
# once, and any other tick that moved or restaked (a new grant is acted on at once)
RUN = {}
def run_reset():
    RUN.clear()
    RUN.update({"ap_checked": 0, "ap_wallets": set(), "ap_moves": 0, "ap_txs": [], "ap_uatone": 0, "ap_gain": 0.0, "ap_failed": 0,
                "rs_checked": 0, "rs_done": 0, "rs_txs": [], "rs_rewards": 0, "rs_staked": 0, "rs_failed": 0, "rs_small": 0})

def tx_cost(hashes):
    """gas used and the fee paid (uphoton) for our transactions, read back from the chain"""
    gas = fee = 0
    for h in hashes:
        for attempt in range(3):
            try:
                t = get("/cosmos/tx/v1beta1/txs/%s" % h)
                gas += int(t["tx_response"].get("gas_used") or 0)
                fee += sum(int(a["amount"]) for a in t["tx"]["auth_info"]["fee"]["amount"] if a["denom"] == "uphoton")
                break
            except Exception:
                time.sleep(2)
    return gas, fee

def run_summaries(c, n_ap, n_rs, dry):
    """Discord: one message per scheduled run of each service, and one for any other tick that did something"""
    slot, tag = slot0(), " (dry run)" if dry else ""
    when = time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(slot))
    for kind in ("autopilot", "restake"):
        row = c.execute("SELECT at FROM alert_sent WHERE granter='_run' AND k=?", (kind,)).fetchone()
        scheduled = not row or row[0] < slot
        if kind == "autopilot":
            did = RUN["ap_moves"] or RUN["ap_failed"]
            if not (scheduled or did): continue
            gas, fee = tx_cost(RUN["ap_txs"])
            f = {"Run": when if scheduled else "outside the schedule (a new grant)", "Autopilot wallets": n_ap,
                 "Wallets checked": RUN["ap_checked"], "Wallets moved": len(RUN["ap_wallets"]), "Moves": RUN["ap_moves"],
                 "Transactions": len(RUN["ap_txs"]), "ATONE moved": "{:,.1f}".format(RUN["ap_uatone"] / 1e6),
                 "Gain": "+{:,.1f} ATONE a year".format(RUN["ap_gain"]), "Gas": "{:,}".format(gas),
                 "Fees": "{:,.4f} PHOTON".format(fee / 1e6), "Failed": RUN["ap_failed"]}
            if RUN["ap_txs"]: f["Tx"] = "\n".join(RUN["ap_txs"])
            if RUN["ap_wallets"]: f["Wallets"] = "\n".join(sorted(RUN["ap_wallets"]))
            discord("crit" if RUN["ap_failed"] else "ok" if RUN["ap_moves"] else "info", "Autopilot run" + tag,
                    "%d wallets moved, %d moves in %d transactions." % (len(RUN["ap_wallets"]), RUN["ap_moves"], len(RUN["ap_txs"])), f)
        else:
            did = RUN["rs_done"] or RUN["rs_failed"]
            if not (scheduled or did): continue
            gas, fee = tx_cost(RUN["rs_txs"])
            f = {"Run": when if scheduled else "outside the schedule (Restake turned on)", "Restake wallets": n_rs,
                 "Wallets checked": RUN["rs_checked"], "Wallets restaked": RUN["rs_done"], "Under 1 ATONE (skipped)": RUN["rs_small"],
                 "Transactions": len(RUN["rs_txs"]), "Rewards claimed": "{:,.4f} ATONE".format(RUN["rs_rewards"] / 1e6),
                 "ATONE restaked": "{:,.4f}".format(RUN["rs_staked"] / 1e6), "Gas": "{:,}".format(gas),
                 "Fees": "{:,.4f} PHOTON".format(fee / 1e6), "Failed": RUN["rs_failed"]}
            if RUN["rs_txs"]: f["Tx"] = "\n".join(RUN["rs_txs"])
            discord("crit" if RUN["rs_failed"] else "ok" if RUN["rs_done"] else "info", "Restake run" + tag,
                    "%d wallets restaked, %d transactions." % (RUN["rs_done"], len(RUN["rs_txs"])), f)
        if scheduled:
            c.execute("INSERT OR REPLACE INTO alert_sent VALUES('_run', ?, ?)", (kind, slot)); c.commit()

def restake_grants():
    """granter -> what they let us do with rewards: claim (a GenericAuthorization for
    MsgWithdrawDelegatorReward) and stake (StakeAuthorization DELEGATE: allow-list, deny-list, what is left
    of its cap). Nothing else is read: a restake never sends"""
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
                              "deny": (a.get("deny_list") or {}).get("address") or [],
                              "cap": int(cap["amount"]) if cap and cap.get("denom") == "uatone" else None}
        key = d.get("pagination", {}).get("next_key")
        if not key: break
    return {k: v for k, v in out.items() if v.get("claim") and v.get("stake")}

def plan_restake(c, granter, rg, vals, m):  # noqa: C901
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
    # keeps to them, and a validator its grant denies is never picked (the chain would refuse it; audit 2026-09-30)
    allow, deny = set(rg["stake"]["allow"] or []), set(rg["stake"].get("deny") or [])
    ranked = sorted(vals.values(), key=lambda v: -v["t"])
    pool = [v for v in ranked[:max(0, len(ranked) - RS_EDGE)] if (not allow or v["op"] in allow) and v["op"] not in deny]
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

def restake_step(c, granter, rgs, vals, m, dry):
    """plan, execute when allowed, record; returns what the report shows"""
    rg = rgs.get(granter)
    if not rg: return None
    try:
        p = plan_restake(c, granter, rg, vals, m)
    except Exception as e:
        return {"error": str(e)[:200]}
    live = RESTAKE and not dry
    if "claim" in p:
        amt = sum(s["amount"] for s in p["stake"])
        if live:
            r = execute_restake(granter, p); p["result"] = r
            ok = "txhash" in r and "error" not in r
            if ok: RUN["rs_done"] += 1; RUN["rs_txs"].append(r.get("txhash")); RUN["rs_rewards"] += int(p["rewards"]); RUN["rs_staked"] += int(amt)
            else: RUN["rs_failed"] += 1
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
            t = calendar.timegm(time.strptime(e["redelegation_entry"]["completion_time"][:19], "%Y-%m-%dT%H:%M:%S"))
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

def plan(g, rows, reds, vals, m, room=None):
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
    except Exception as e:
        # the signer never answered, or not in JSON: a timeout may still have broadcast, so the next try plans from the
        # chain again (any exception, audit 2026-09-30: one escaping here would leave a sent tx with no retry row)
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
    """the tx by hash: its result code, raw log and codespace, or None when the chain does not have it"""
    try: t = get("/cosmos/tx/v1beta1/txs/" + h).get("tx_response") or {}
    except urllib.error.HTTPError as e:
        if e.code in (400, 404): return None
        raise
    return int(t.get("code", 0)), t.get("raw_log", ""), t.get("codespace", "")

def moves_today(c, granter):
    """stake-moving messages signed for this wallet in the last 24 hours: its moves and its restakes (one delegation
    each). The signer counts the same and refuses past MAX_MOVES_DAY, so a plan is made to fit (audit 2026-09-30)"""
    t = int(time.time()) - 86400
    return (c.execute("SELECT count(*) FROM move WHERE granter=? AND at>? AND dry=0", (granter, t)).fetchone()[0]
            + c.execute("SELECT count(*) FROM restake WHERE granter=? AND at>? AND dry=0 AND txhash IS NOT NULL", (granter, t)).fetchone()[0])

def report(granter, obj):
    # the public file never carries the signer's answer, an older report's included (audit 2026-09-30)
    if "last" in obj: obj["last"] = public_last(obj["last"])
    if isinstance(obj.get("restake"), dict) and "result" in obj["restake"]: obj["restake"]["result"] = public_last(obj["restake"]["result"])
    os.makedirs(REPORTS, exist_ok=True)
    tmp = os.path.join(REPORTS, granter + ".json.tmp")
    json.dump(obj, open(tmp, "w")); os.replace(tmp, os.path.join(REPORTS, granter + ".json"))

def plan_fields(gr, p):
    f = {"Delegator": gr}
    if p and p.get("moves"):
        f["Moves"] = "%d, %s ATONE" % (len(p["moves"]), "{:,.1f}".format(sum(int(m["amount"]) for m in p["moves"]) / 1e6))
        f["Gain"] = "+%s ATONE a year" % "{:,.1f}".format(p.get("gain") or 0)
        if p.get("now") is not None: f["APR"] = "%.1f%% to %.1f%%" % (p["now"] * 100, p["after"] * 100)
    else:
        f["Moves"] = "none: the stake already sits well"
    return f

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
    # in parts of at most MAX_MOVES_TX, one transaction each, in order; a part that fails stops the rest, and what
    # landed before it stays recorded (the retry plans again from the chain)
    moves, sent, r = p["moves"], [], {}
    if moves_today(c, gr) + len(moves) > MAX_MOVES_DAY:
        r = {"error": "daily move limit (%d) reached" % MAX_MOVES_DAY}
    else:
        for k in range(0, len(moves), MAX_MOVES_TX):
            part = moves[k:k + MAX_MOVES_TX]
            r = execute(gr, part)
            if not ("txhash" in r and "error" not in r): moves = moves[k:]; break
            record_moves(c, gr, part, r.get("txhash"), now); c.commit()
            RUN["ap_wallets"].add(gr); RUN["ap_moves"] += len(part); RUN["ap_txs"].append(r.get("txhash"))
            RUN["ap_uatone"] += sum(int(e["amount"]) for e in part); RUN["ap_gain"] += sum(float(e.get("gain", 0)) for e in part)
            sent.append(r.get("txhash"))
        else:
            moves = []
    ok = not moves
    kind, why, h = ("ok", "", r.get("txhash")) if ok else classify(r)
    c.execute("INSERT INTO applied VALUES(?,?,?,?,?,?,?,?,?)", (now, gr, pid, "auto", ",".join(sent) or None, 0, 1 if ok else 0,
              None if ok else ("%s: %s" % ("settled" if kind == "settle" else "will retry", json.dumps(r.get("error"))))[:300], 0))
    c.commit(); out["last"] = public_last(r, kind)
    log("auto exec granter=%s plan=%s parts=%d sent=%s -> %s (%s)" % (gr, pid, -(-len(p["moves"]) // MAX_MOVES_TX), sent, r, kind))
    if sent:
        f["Tx"] = ", ".join(sent)
        if not ok: f["Moved"] = "%d of %d moves" % (len(p["moves"]) - len(moves), len(p["moves"]))
    if ok:
        c.execute("DELETE FROM retry WHERE granter=?", (gr,)); c.commit()      # announced in the run summary (Discord)
        return
    RUN["ap_failed"] += 1
    p = dict(p, moves=moves)                       # what is left is what the retry or the next run is about
    if kind == "settle":
        c.execute("DELETE FROM retry WHERE granter=?", (gr,)); c.commit()
        f["Chain said"] = why
        alert("info", "Autopilot move settled: " + short(gr), "The chain's own rules stop this move (a lock, a full pair or the grant). "
              "Nothing to fix: the next run in 12 hours plans from the chain as it then stands.", f)
    else:
        schedule_retry(c, gr, kind, why, h, p["moves"], f)

def public_last(r, kind=None):
    """what the public report shows of the last execution (audit 2026-09-30): the tx on success, else only the reason's
    class - never the signer's answer, whose errors can name RPCs and internals"""
    if not isinstance(r, dict): return None
    if set(r) <= {"error"} and r.get("error") in ("retry", "settled", "pending"): return {"error": r["error"]}
    if "txhash" in r and "error" not in r: return {"txhash": r.get("txhash"), "height": r.get("height")}
    kind = kind or classify(r)[0]
    return {"error": "settled" if kind == "settle" else kind}

def public_err(e):
    """an applied row's error as the public report shows it: the class word only (the full text stays in keeper.db)"""
    if not e: return None
    return "settled" if e.startswith("settled") else "pending" if "not yet found" in e else "retry"

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
                return {"txhash": h, "code": r[0], "raw": r[1], "codespace": r[2], "moves": _tx_moves(t, gr)}
        # the grantee's txs, newest first, 100 a page and at most 3 pages (audit 2026-09-30: 30 could miss a wallet's
        # tx when many move in one slot). The SDK's tx search pages with page/limit; it ignores pagination.*
        import datetime
        q = "/cosmos/tx/v1beta1/txs?query=" + urllib.parse.quote("message.sender='%s'" % GRANTEE) + "&order_by=ORDER_BY_DESC&limit=100&page="
        for page in (1, 2, 3):
            txs = get(q + str(page)).get("tx_responses", []) or []
            for t in txs:
                try: ts = datetime.datetime.fromisoformat(t["timestamp"].replace("Z", "+00:00")).timestamp()
                except Exception: continue
                if ts < since - 5: return None
                mv = _tx_moves(t, gr)
                if mv and int(t.get("code", 0)) == 0: return {"txhash": t["txhash"], "code": 0, "raw": "", "moves": mv}
            if len(txs) < 100: break
    except Exception as e:
        log("landed lookup for %s failed: %s" % (gr, e)); return "unknown"
    return None

def _tx_moves(t, gr):
    out = []
    for m in (((t.get("tx") or {}).get("body") or {}).get("messages") or []):
        for x in m.get("msgs", []) or []:
            if x.get("delegator_address") == gr and x.get("@type", "").endswith("MsgBeginRedelegate"):
                out.append({"src": x["validator_src_address"], "dst": x["validator_dst_address"], "amount": int(x["amount"]["amount"]), "gain": 0})
    return out

def settle_landed(c, gr, seen, moves=None):
    """a move found on chain after a failure: recorded as the move when it succeeded, and the retry is over. One that
    landed with code != 0 is classified like any failure (audit 2026-09-30): a retry-class reason (out of gas, a fee)
    keeps its RETRY_WAITS, a chain-rule reason settles to the next slot"""
    now = int(time.time())
    if seen["code"] == 0 and seen["moves"] and not c.execute("SELECT 1 FROM move WHERE txhash=?", (seen["txhash"],)).fetchone():
        record_moves(c, gr, seen["moves"], seen["txhash"], now)
        c.execute("INSERT INTO applied VALUES(?,?,?,?,?,?,?,?,?)", (now, gr, plan_id({"moves": seen["moves"]}), "auto", seen["txhash"], 0, 1, None, 0))
        RUN["ap_wallets"].add(gr); RUN["ap_moves"] += len(seen["moves"]); RUN["ap_txs"].append(seen["txhash"])    # in the run summary
        RUN["ap_uatone"] += sum(int(e["amount"]) for e in seen["moves"])
    elif seen["code"] != 0:
        raw = str(seen.get("raw") or "")
        log("tx %s for %s landed with code %s: %s" % (seen["txhash"], gr, seen["code"], raw[:200]))
        kind, why, _ = classify({"error": "code %d (codespace: %s) %s" % (seen["code"], seen.get("codespace") or "sdk", raw)})
        if kind == "retry":
            schedule_retry(c, gr, kind, why, None, moves or seen["moves"], {"Delegator": gr, "Tx": seen["txhash"]})
            return
    c.execute("DELETE FROM retry WHERE granter=?", (gr,)); c.commit()

def once(c, only=None, live=None, force=False):
    """One tick. Each delegator is planned once per 12-hour slot (00:00 and 12:00 UTC), at once when its grant is new
    or changed, and a failed move again at its retry time; a plan is carried out in the run that makes it. A Disabled
    wallet is skipped. only=<granter> restricts it; live overrides KEEPER_DRY for this tick; force plans now."""
    dry = DRY if live is None else (not live)
    fresh()
    vals, m, eta = model()
    # the set as the chain has it now (not the 15-minute collect): anything already executed is simply there
    # no silent fallback to the collector's stakes: a tick without the live set does nothing
    vals = live_vals(vals)
    # first come, first served (operator, 2026-09-29): grants are planned in the order they were made, and each
    # move carried out this tick is counted as placed before the next grant is planned - the first grantee gets the
    # top strategy, the next one the next best
    work = {op: dict(v) for op, v in vals.items()}
    def claim(moves):
        for mv in moves or []:
            amt = mv.get("uatone", mv.get("amount", 0))
            if mv["src"] in work: work[mv["src"]]["t"] -= amt
            if mv["dst"] in work: work[mv["dst"]]["t"] += amt
    tick0 = int(time.time()); run_reset()
    gs = [g for g in grants() if not only or g["granter"] == only]; acted = 0
    gs.sort(key=lambda g: granted_at(g["granter"], c))
    try: rgs = restake_grants()
    except Exception as e: rgs = {}; log("restake grants unreadable: %s" % e)
    adm = admin()
    for g in gs:
        gr = g["granter"]
        try:
            # no strategies: one fixed rule for every Autopilot (the report still names it "moderate")
            name = "moderate"
            path = os.path.join(REPORTS, gr + ".json")
            try: prev = json.load(open(path))
            except Exception: prev = None
            last = c.execute("SELECT max(at) FROM run_g WHERE granter=?", (gr,)).fetchone()[0] or 0
            # the grant as it stands: a re-grant (Change, a new validator list, expiry or a higher cap) is planned at once,
            # not at the next slot, so the console never shows a plan made for the grant it replaced
            due = force or not last or last < slot0() or grant_changed(g, prev)
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
                    settle_landed(c, gr, seen, json.loads(rt[3] or "[]")); due = False
                elif rt[2] and time.time() - (rt[4] or 0) < 1800: due = False
                else: due = True
            if gr in adm["paused"]: due = False
            p = None
            if due:
                rows, reds = position(gr, work)
                p = plan(g, rows, reds, work, m, room=MAX_MOVES_DAY - moves_today(c, gr)) or {"moves": []}
                c.execute("INSERT INTO run_g VALUES(?,?)", (int(time.time()), gr)); c.commit()
                RUN["ap_checked"] += 1
                record = rate_record(c, gr, rows)
                rep = {"granter": gr, "checked": int(time.time()), "dry": dry, "strategy": name,
                       "grant": {"cap": g["cap"], "allow": len(g["allow"]) if g["allow"] else None, "expires": g["exp"]}, "grant_sig": grant_sig(g),
                       "staked": sum(r["x"] for r in rows), "now": p.get("now"), "after": p.get("after"), "gain": p.get("gain"),
                       "moves": [{"src": e["src"], "dst": e["dst"], "uatone": e["amount"], "gain": round(e["gain"], 3)} for e in p["moves"]], "last": None}
                if record: rep["record"] = record
                # the redelegation lock, for the console's Cooling down: what is held and when the last of it clears
                ends = [calendar.timegm(time.strptime(e["redelegation_entry"]["completion_time"][:19], "%Y-%m-%dT%H:%M:%S"))
                        for r in reds for e in r.get("entries", [])]
                rep["locked"] = sum(r["locked"] for r in rows)
                rep["until"] = int(max([t for t in ends if t > time.time()] or [0])) or None
                if prev and prev.get("restake"): rep["restake"] = prev["restake"]
                pid = plan_id(p)
                if p["moves"]: log("granter=%s plan %s: %d moves, +%.1f ATONE a year" % (gr, pid, len(p["moves"]), p["gain"]))
            else:
                rep = prev or {"granter": gr, "strategy": name, "moves": []}
                pid = (rep.get("admin") or {}).get("plan_id")
            # no approval (operator, 2026-09-30): a plan is carried out in the run that makes it. Disable (the console's
            # stop) stops everything for a delegator
            if due and p and p["moves"] and gr not in adm["paused"]:
                auto_apply(c, g, p, pid, dry, rep)
            elif due and p is not None and not p["moves"]:
                c.execute("DELETE FROM retry WHERE granter=?", (gr,)); c.commit()     # nothing left to move: nothing to retry
            # the history after this run's move, so a move made now is in the report now (a grant it used up gets no later run)
            hist = c.execute("SELECT at, src, dst, uatone, gain, txhash FROM move WHERE granter=? AND dry=0 ORDER BY at DESC LIMIT 10", (gr,)).fetchall()
            rep["history"] = [{"at": h[0], "src": h[1], "dst": h[2], "uatone": h[3], "gain": h[4], "txhash": h[5]} for h in hist]
            last = c.execute("SELECT at, plan_id, by, txhash, dry, ok, error FROM applied WHERE granter=? ORDER BY at DESC, rowid DESC LIMIT 1", (gr,)).fetchone()
            rep["admin"] = {"state": "held" if gr in adm["paused"] else "auto", "plan_id": pid}
            if last: rep["admin"]["applied"] = {"at": last[0], "plan_id": last[1], "by": last[2], "txhash": last[3], "dry": bool(last[4]), "ok": bool(last[5]),
                                                "error": public_err(last[6])}
            ad_ = rep["admin"]
            if due and p is not None and (ad_.get("applied") or {}).get("at", 0) >= tick0 and (ad_.get("applied") or {}).get("ok"):
                claim(rep.get("moves"))          # a plan made this tick; a move found on chain is in the live set already
            if rep["admin"].get("applied", {}).get("at", 0) >= int(time.time()) - TICK: acted += 1
            rep["dry"] = dry
            report(gr, rep)
        except Exception as e:
            log("granter %s failed: %s" % (gr, e))
    # restake, its own service with fixed rules - the same for everyone, Autopilot or not: every 12 hours, from
    # 1 ATONE of rewards, staked on the best-paying validator the wallet's delegate grant allows (its own), under the
    # usual checks (withdraw address, other services, the cap, the dry switch, Disable). No admin step.
    for granter in rgs:
        if only and granter != only: continue
        try:
            if granter in adm["paused"]: continue
            seen = c.execute("SELECT at FROM rs_run WHERE granter=?", (granter,)).fetchone()
            if not force and seen and seen[0] >= slot0(): continue
            c.execute("INSERT INTO rs_run VALUES(?,?) ON CONFLICT(granter) DO UPDATE SET at=excluded.at", (granter, int(time.time()))); c.commit()
            rs = restake_step(c, granter, rgs, work, m, dry)
            RUN["rs_checked"] += 1
            if (rs or {}).get("skip") == "below 1 ATONE": RUN["rs_small"] += 1
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
        atone = next((int(b["amount"]) for b in s.get("balances", []) if b["denom"] == "uatone"), 0)
        low_funds(c, photon, atone)
    except Exception as e:
        log("status failed: %s" % e)
    try:
        signer_health(c)
    except Exception as e:
        log("status failed: %s" % e)
    if not only:
        try: run_summaries(c, len(gs), len(rgs), dry)
        except Exception as e: log("run summary failed: %s" % e)

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

# the money that keeps the service running (operator, 2026-10-01), to Discord: on mainnet the signer's PHOTON (the
# treasury that pays every fee) under 15; on testnet the same account is the faucet: under 100 ATONE or 10 PHOTON
LOW = {"mainnet": {"uphoton": 15_000_000}, "testnet": {"uatone": 100_000_000, "uphoton": 10_000_000}}
def low_funds(c, photon, atone):
    """once on the way down, again every 24 hours while low, once when funded back above; a marker row per denom"""
    now, have = int(time.time()), {"uphoton": photon, "uatone": atone}
    who = "Treasury (Autopilot signer)" if NET == "mainnet" else "Testnet faucet"
    for denom, floor in LOW["testnet" if NET == "testnet" else "mainnet"].items():
        sym, k = denom[1:].upper(), "low_" + denom
        row = c.execute("SELECT at FROM alert_sent WHERE granter='_signer' AND k=?", (k,)).fetchone()
        f = {"Address": GRANTEE, "Balance": "{:,.2f} {}".format(have[denom] / 1e6, sym), "Alert below": "{:,.0f} {}".format(floor / 1e6, sym)}
        if have[denom] < floor:
            if not row or now - row[0] >= 86400:
                discord("warn", "%s low on %s: %s left" % (who, sym, "{:,.2f}".format(have[denom] / 1e6)),
                        ("Send %s to the address below." % sym) + (" It pays every Autopilot and Restake fee." if NET == "mainnet" else ""), f)
                c.execute("INSERT OR REPLACE INTO alert_sent VALUES('_signer', ?, ?)", (k, now)); c.commit()
        elif row:
            discord("ok", "%s funded: %s %s" % (who, "{:,.2f}".format(have[denom] / 1e6), sym), "", f)
            c.execute("DELETE FROM alert_sent WHERE granter='_signer' AND k=?", (k,)); c.commit()


def main():
    """Service: a tick every KEEPER_TICK (60 s); each delegator planned at 00:00 and 12:00 UTC, at once when its grant
    is new or changed. By hand:  keeper.py --once [--granter atone1...] [--live] [--force]
              --once   one tick, then exit (respects KEEPER_DRY unless --live)
              --live   carry plans out for real on this tick only
              --force  plan now even if not due"""
    if not GRANTEE or not SIGNER or not SECRET:
        log("not configured (KEEPER_GRANTEE / KEEPER_SIGNER_URL / the keeper_secret credential or KEEPER_SECRET) - parking"); sys.exit(78)
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
