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
and ATOMONE_API pointed at testnet. Mainnet reads the box's own node (127.0.0.1:3999) unless ATOMONE_API says otherwise.
"""
import calendar, hashlib, json, os, re, sqlite3, sys, time, urllib.request, urllib.error, urllib.parse

# Discord, through the app's one sender (bin/notify.py; the webhook comes from the unit's alerts env)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "bin"))
try:
    import notify
except Exception:                                   # no sender: alerts are logged, never fatal
    notify = None

NET = os.environ.get("NET", "mainnet")
# (red team 2026-10-01) mainnet reads the box's own node: the public API shares one nginx rate-limit bucket with the
# world, and a flood there must not starve the keeper. An ATOMONE_API in the env still wins (testnet sets its own)
API = (os.environ.get("ATOMONE_API") or ("http://127.0.0.1:3999" if NET == "mainnet" else "https://atomone-api.gatadao.com")).rstrip("/")
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
# (red team 2026-10-01) fee griefing: a grant that ends between our read and the block fails at delivery and the
# signer pays. A grant ending within EXP_MIN_S is not acted on; fees paid for one wallet over FEE_DAY in any 24 hours
# (any code) hold it until the window passes; a failure that says the grant or the stake is gone holds it HOLD_S,
# and a re-grant does not lift that
EXP_MIN_S = 86400
FEE_DAY = 8_000_000           # uphoton: 8 PHOTON per wallet per 24 hours (operator, 2026-10-01: was 3, under one full 60-move run ~7)
HOLD_S = 86400
HOLD_WORDS = ("authorization not found", "authorization expired", "failed to get grant", "not enough delegation",
              "insufficient delegation", "no delegation", "delegation does not exist", "validator does not exist",
              "transitive", "already in progress")
MAX_LIST = 64                 # (red team 2026-10-01) a grant whose allow or deny list is longer is ignored: the page never builds more than ~31
# restake: claim a granter's rewards and stake them back onto their allow-list. Planned and
# reported always; executed only with KEEPER_RESTAKE=1 AND KEEPER_DRY=0
RESTAKE = os.environ.get("KEEPER_RESTAKE", "0") == "1"
MIN_RESTAKE = float(os.environ.get("KEEPER_MIN_RESTAKE_ATONE", "1"))       # skip while rewards are below this
RS_LEGS = 10                  # a restake stakes on at most 10 validators (the shelf it pours into)
MAX_CLAIM = int(os.environ.get("KEEPER_MAX_CLAIM", "18"))                  # validators claimed in one transaction (the signer takes 20 messages)
RESTAKE_URL = os.environ.get("KEEPER_RESTAKE_URL", "") or (SIGNER.rsplit("/", 1)[0] + "/authz-restake" if SIGNER else "")
WDRAW_URL = "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"
# one keeper per network: testnet runs a second unit with these pointed at web/testnet
# and its own state (mainnet keeps the defaults)
DATA = os.environ.get("KEEPER_DATA", "/srv/atomone-app/web/data.json")
STATE = os.environ.get("KEEPER_STATE", "/srv/atomone-app/keeper/state/keeper.db")
REPORTS = os.environ.get("KEEPER_REPORTS", "/srv/atomone-app/web/keeper")
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
    # (2026-10-01, the state audit) one row per run of each service that was announced, and one per transaction we
    # broadcast with what the chain says it cost: fees come from the chain, never from gas_used (the signer pays
    # gas_wanted, ~1.35x more)
    c.execute("CREATE TABLE IF NOT EXISTS run_sum(id INTEGER PRIMARY KEY, at INT, slot INT, service TEXT, kind TEXT, dry INT, wallets INT,"
              " checked INT, acted INT, skipped INT, failed INT, msgs INT, txs INT, uatone INT, gain REAL, gas_used INT, fee_uphoton INT, photon_after INT)")
    c.execute("CREATE TABLE IF NOT EXISTS tx_log(txhash TEXT PRIMARY KEY, at INT, service TEXT, granter TEXT, msgs INT, uatone INT, height INT,"
              " code INT, gas_wanted INT, gas_used INT, fee_uphoton INT, run_id INT)")
    # (red team 2026-10-01) every broadcast that did not land as a success (a code != 0, a 502 with a txhash, a tx sent
    # and not yet seen): it counts in the wallet's day like a move. A wallet held after a failure that says its grant
    # or stake is gone: a re-grant does not clear it
    c.execute("CREATE TABLE IF NOT EXISTS failed_tx(txhash TEXT PRIMARY KEY, at INT, granter TEXT, service TEXT, msgs INT)")
    c.execute("CREATE TABLE IF NOT EXISTS hold(granter TEXT PRIMARY KEY, until INT, why TEXT, at INT, err TEXT)")
    try: c.execute("ALTER TABLE restake ADD COLUMN error TEXT")
    except sqlite3.OperationalError: pass
    for ix in ("run_g(granter, at)", "applied(granter, at)", "move(granter, at)", "move(txhash)", "restake(granter, at)", "rate_log(granter, at)", "tx_log(granter, at)", "failed_tx(granter, at)"):
        c.execute("CREATE INDEX IF NOT EXISTS ix_%s ON %s" % (ix.split("(")[0] + "_" + ix.split("(")[1].split(",")[1 if "," in ix else 0].strip(" )"), ix))
    c.execute("PRAGMA busy_timeout=5000")
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
def exp_ts(exp):
    """a grant's expiration as epoch seconds (UTC), None when it has none"""
    return calendar.timegm(time.strptime(exp[:19], "%Y-%m-%dT%H:%M:%S")) if exp else None

BIG = set()
def too_long(g, a):
    """(red team 2026-10-01) an allow or deny list over MAX_LIST: the grant is ignored, logged once per granter"""
    n = max(len((a.get("allow_list") or {}).get("address") or []), len((a.get("deny_list") or {}).get("address") or []))
    if n <= MAX_LIST: return False
    k = (g.get("granter"), a.get("@type"), a.get("authorization_type") or a.get("msg"))
    if k not in BIG: BIG.add(k); log("ignored a grant from %s: a validator list of %d (over %d)" % (g.get("granter"), n, MAX_LIST))
    return True

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
            if too_long(g, a): continue
            allow = (a.get("allow_list") or {}).get("address") or None
            deny = set((a.get("deny_list") or {}).get("address") or [])
            cap = a.get("max_tokens"); cap = int(cap["amount"]) if cap and cap.get("denom") == "uatone" else None
            out.append({"granter": g["granter"], "allow": allow, "deny": deny, "cap": cap, "exp": exp, "exp_ts": exp_ts(exp)})
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

# the grant ledger (grantwatch's), in the shared state dir; since 2026-10-01 the admin file lives in its own dir, so the
# ledger is no longer found beside it
LEDGER = os.environ.get("KEEPER_LEDGER") or "/srv/atomone-app/state/grants-%s.json" % NET
def ledger():
    """grantwatch's ledger, {} when it cannot be read; read once per tick (red team 2026-10-01: it was re-read per grant)"""
    try:
        with open(LEDGER) as f: return json.load(f).get("grants") or {}
    except Exception:
        return {}

def granted_at(granter, c, led=None):
    """when the grant was made (grantwatch's ledger reads it from the grant's transaction), else when the
    keeper first saw it: grants are planned in this order"""
    try:
        e = (ledger() if led is None else led).get(granter) or {}
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
                "rs_checked": 0, "rs_done": 0, "rs_txs": [], "rs_rewards": 0, "rs_staked": 0, "rs_failed": 0, "rs_small": 0, "txinfo": {},
                "ap_bad": [], "rs_bad": [], "ap_held": 0, "rs_held": 0, "ap_fail": [], "rs_list": [], "rs_fail": []})

def tx_chain(h):
    """what the chain says one of our transactions cost: height, code, gas wanted and used, fee in uphoton (None if unread)"""
    for attempt in range(3):
        try:
            t = get("/cosmos/tx/v1beta1/txs/%s" % h); r = t["tx_response"]
            return {"height": int(r.get("height") or 0), "code": int(r.get("code") or 0), "gas_wanted": int(r.get("gas_wanted") or 0),
                    "gas_used": int(r.get("gas_used") or 0),
                    "fee": sum(int(a["amount"]) for a in t["tx"]["auth_info"]["fee"]["amount"] if a["denom"] == "uphoton")}
        except Exception:
            time.sleep(2)
    return None

def tx_cost(hashes, c=None, service=None):
    """gas used and fees paid for our transactions, from the chain; each one is logged in tx_log when c is given"""
    gas = fee = 0
    for h in hashes:
        d = tx_chain(h)
        if not d: continue
        gas += d["gas_used"]; fee += d["fee"]
        if c is not None:
            info = RUN.get("txinfo", {}).get(h, {})
            c.execute("INSERT OR REPLACE INTO tx_log VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", (h, info.get("at", int(time.time())), service, info.get("granter"),
                      info.get("msgs"), info.get("uatone"), d["height"], d["code"], d["gas_wanted"], d["gas_used"], d["fee"], None))
    if c is not None: c.commit()
    return gas, fee

def tx_backfill(c):
    """once: every transaction already recorded in move / restake, read back from the chain into tx_log"""
    if c.execute("SELECT count(*) FROM tx_log").fetchone()[0]: return
    rows = [(h, "autopilot", g, n, u, a) for h, g, n, u, a in c.execute(
                "SELECT txhash, granter, count(*), sum(uatone), min(at) FROM move WHERE dry=0 AND txhash IS NOT NULL GROUP BY txhash")]
    rows += [(h, "restake", g, None, u, a) for h, g, u, a in c.execute(
                "SELECT txhash, granter, staked, at FROM restake WHERE dry=0 AND txhash IS NOT NULL")]
    for h, svc, g, n, u, a in rows:
        d = tx_chain(h)
        if d: c.execute("INSERT OR REPLACE INTO tx_log VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", (h, a, svc, g, n, u, d["height"], d["code"], d["gas_wanted"], d["gas_used"], d["fee"], None))
    c.commit(); log("tx_log backfilled: %d transactions" % len(rows))

def impact(c):
    """what Autopilot and Restake have done in all (2026-10-01), from the landed rows: every Autopilot move goes to a
    smaller validator by the rule, so this is stake taken down the set"""
    m = c.execute("SELECT coalesce(sum(uatone), 0), count(DISTINCT granter), count(DISTINCT dst), coalesce(sum(gain), 0), count(DISTINCT txhash)"
                  " FROM move WHERE dry=0 AND txhash IS NOT NULL").fetchone()
    r = c.execute("SELECT coalesce(sum(staked), 0), count(*), count(DISTINCT granter) FROM restake WHERE dry=0 AND txhash IS NOT NULL").fetchone()
    return {"moved_uatone": int(m[0]), "wallets": m[1], "validators": m[2], "gain_atone_year": round(m[3], 1), "txs": m[4],
            "restaked_uatone": int(r[0]), "restakes": r[1], "restake_wallets": r[2]}

EXPLORER = os.environ.get("EXPLORER_TX", "https://explorer.gatahub.zone/atomone-1/txs/" if NET == "mainnet" else "")

def _md(x):
    """a chain string (a moniker is anyone's text) in a Discord message: its markdown characters escaped"""
    return re.sub(r"([\\`*_~|>\[\]()#<@])", r"\\\1", str(x))[:40]

def _names():
    """validator -> (moniker, rank), from the collector's record"""
    try: return {v["op"]: (v["m"], v.get("rank")) for v in json.load(open(DATA))["validators"]}
    except Exception: return {}

def _vals(N, ops, k=3):
    """validators in rank order as "Name (#r)", the first k and how many more"""
    ops = sorted(set(ops), key=lambda o: (N.get(o, ("", 999))[1] or 999))
    out = ["%s (#%s)" % (_md(N[o][0]), N[o][1]) if o in N and N[o][1] else ("inactive validator " + o[:20] + "\u2026") for o in ops]
    return ", ".join(out) if len(out) <= k else "%s and %d more" % (", ".join(out[:k]), len(out) - k)

def _tx(h):
    return ("[%s](%s%s)" % (h[:8], EXPLORER, h)) if h and EXPLORER else (h or "")[:8]

def _why(t):
    """a failed broadcast's reason in plain words"""
    l = str(t).lower()
    if "spendable balance" in l or "insufficient fee" in l or "insufficient funds" in l: return "the fee account is short of PHOTON"
    if "429" in l or "rate limit" in l: return "the node was busy (rate limited)"
    if "authorization not found" in l or "authorization expired" in l: return "the grant is gone"
    if "not yet seen" in l: return "sent, not yet seen on chain"
    return str(t)[:100]

def _lines(text, lines, tail):
    """the message within Discord's limit: what does not fit is counted, never cut mid-line"""
    out, n = (text if lines else text.rstrip("\n") + "\n"), 0
    for ln in lines:
        if len(out) + len(ln) + len(tail) + 80 > 3800: break
        out += ln + "\n"; n += 1
    if n < len(lines): out += "and %d more (the admin console lists them all)\n" % (len(lines) - n)
    return out + tail

def run_summaries(c, n_ap, n_rs, dry):
    """Discord: one message per scheduled run of each service, and one for any other tick that did something"""
    slot, tag = slot0(), " (dry run)" if dry else ""
    RUN["slot_run"] = any((c.execute("SELECT at FROM alert_sent WHERE granter='_run' AND k=?", (k,)).fetchone() or [0])[0] < slot for k in ("autopilot", "restake"))
    for kind in ("autopilot", "restake"):
        row = c.execute("SELECT at FROM alert_sent WHERE granter='_run' AND k=?", (kind,)).fetchone()
        scheduled = not row or row[0] < slot
        if kind == "autopilot":
            did = RUN["ap_moves"] or RUN["ap_failed"]
            if not (scheduled or did): continue
            gas, fee = tx_cost(RUN["ap_txs"] + RUN["ap_bad"], c, "autopilot")     # a failed broadcast pays too (red team 2026-10-01)
            c.execute("INSERT INTO run_sum(at, slot, service, kind, dry, wallets, checked, acted, skipped, failed, msgs, txs, uatone, gain, gas_used, fee_uphoton, photon_after)"
                      " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (int(time.time()), slot, kind, "slot" if scheduled else "grant", int(dry), n_ap, RUN["ap_checked"],
                      len(RUN["ap_wallets"]), 0, RUN["ap_failed"], RUN["ap_moves"], len(RUN["ap_txs"]), int(RUN["ap_uatone"]), RUN["ap_gain"], gas, fee, RUN.get("photon")))
            # (operator, 2026-10-09) an admin watch in sentences: what moved, from which validator to which, how many moves
            N, im, held = _names(), impact(c), (" %d held." % RUN["ap_held"]) if RUN["ap_held"] else ""
            if RUN["ap_moves"]:
                text = ("Moved {:,.1f} ATONE for %d wallet%s in %d moves (%d transaction%s), +{:,.1f} ATONE a year. Fees {:,.4f} PHOTON.%s\n\n"
                        .format(RUN["ap_uatone"] / 1e6, RUN["ap_gain"], fee / 1e6)
                        % (len(RUN["ap_wallets"]), "" if len(RUN["ap_wallets"]) == 1 else "s", RUN["ap_moves"],
                           len(RUN["ap_txs"]), "" if len(RUN["ap_txs"]) == 1 else "s", held))
            else:
                text = "Checked %d wallet%s, nothing to move.%s\n\n" % (RUN["ap_checked"], "" if RUN["ap_checked"] == 1 else "s", held)
            lines, txs = [], [t for t in RUN["ap_txs"] if t]
            if txs:
                rows = c.execute("SELECT granter, src, dst, uatone, gain, txhash FROM move WHERE dry=0 AND txhash IN (%s)" % ",".join("?" * len(txs)), txs).fetchall()
                by = {}
                for g, src, dst, u, gain, h in rows:
                    w = by.setdefault(g, {"src": [], "dst": [], "u": 0, "gain": 0.0, "n": 0, "tx": []})
                    w["src"].append(src); w["dst"].append(dst); w["u"] += u; w["gain"] += gain or 0; w["n"] += 1
                    if h not in w["tx"]: w["tx"].append(h)
                for g, w in sorted(by.items(), key=lambda kv: -kv[1]["u"]):
                    lines.append("`%s` {:,.1f} ATONE from %s to %s, %d move%s, +{:,.1f} ATONE a year, %s".format(w["u"] / 1e6, w["gain"])
                                 % (short(g), _vals(N, w["src"]), _vals(N, w["dst"]), w["n"], "" if w["n"] == 1 else "s", " ".join(_tx(h) for h in w["tx"])))
            lines = ["Failed: `%s`, %s." % (short(g), _why(w)) for g, w in RUN["ap_fail"]] + lines      # failures first
            tail = "\nSo far Autopilot has moved {:,.1f} ATONE for %d wallets onto %d smaller validators, +{:,.1f} ATONE a year.".format(
                im["moved_uatone"] / 1e6, im["gain_atone_year"]) % (im["wallets"], im["validators"])
            discord("crit" if RUN["ap_failed"] else "ok" if RUN["ap_moves"] else "info",
                    ("Autopilot run " + time.strftime("%H:%M UTC", time.gmtime(slot)) if scheduled else "Autopilot, new grant") + tag,
                    _lines(text, lines, tail))
        else:
            did = RUN["rs_done"] or RUN["rs_failed"]
            if not (scheduled or did): continue
            gas, fee = tx_cost(RUN["rs_txs"] + RUN["rs_bad"], c, "restake")
            c.execute("INSERT INTO run_sum(at, slot, service, kind, dry, wallets, checked, acted, skipped, failed, msgs, txs, uatone, gain, gas_used, fee_uphoton, photon_after)"
                      " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (int(time.time()), slot, kind, "slot" if scheduled else "enabled", int(dry), n_rs, RUN["rs_checked"],
                      RUN["rs_done"], RUN["rs_small"], RUN["rs_failed"], RUN["rs_done"], len(RUN["rs_txs"]), int(RUN["rs_staked"]), 0.0, gas, fee, RUN.get("photon")))
            N, im = _names(), impact(c)
            small = (" %d had under 1 ATONE of rewards." % RUN["rs_small"]) if RUN["rs_small"] else ""
            held = (" %d held." % RUN["rs_held"]) if RUN["rs_held"] else ""
            if RUN["rs_done"]:
                text = ("Restaked {:,.2f} ATONE of rewards for %d wallet%s (%d transaction%s).%s%s Fees {:,.4f} PHOTON.\n\n"
                        .format(RUN["rs_staked"] / 1e6, fee / 1e6)
                        % (RUN["rs_done"], "" if RUN["rs_done"] == 1 else "s", len(RUN["rs_txs"]), "" if len(RUN["rs_txs"]) == 1 else "s", small, held))
            else:
                text = "Checked %d wallet%s, nothing restaked.%s%s\n\n" % (RUN["rs_checked"], "" if RUN["rs_checked"] == 1 else "s", small, held)
            # failures first; no link per restake (a run has dozens, the admin console has every transaction)
            lines = ["Failed: `%s`, %s." % (short(g), _why(w)) for g, w in RUN["rs_fail"]]
            lines += ["`%s` {:,.2f} ATONE onto %s".format(u / 1e6) % (short(g), _vals(N, legs))
                      for g, u, legs, h in sorted(RUN["rs_list"], key=lambda x: -x[1])]
            tail = "\nSo far Restake has staked {:,.2f} ATONE of rewards in %d restakes for %d wallets.".format(
                im["restaked_uatone"] / 1e6) % (im["restakes"], im["restake_wallets"])
            discord("crit" if RUN["rs_failed"] else "ok" if RUN["rs_done"] else "info",
                    ("Restake run " + time.strftime("%H:%M UTC", time.gmtime(slot)) if scheduled else "Restake, turned on") + tag,
                    _lines(text, lines, tail))
        if scheduled:
            c.execute("INSERT OR REPLACE INTO alert_sent VALUES('_run', ?, ?)", (kind, slot)); c.commit()
    if RUN.get("slot_run"):
        c.execute("DELETE FROM run WHERE at < ?", (int(time.time()) - 30 * 86400,)); c.commit()      # the per-tick log keeps 30 days

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
            if too_long(g, a): continue
            # the earliest end of the two grants Restake needs (red team 2026-10-01: within 24 hours it is not acted on)
            e = exp_ts(exp)
            if t == "/cosmos.authz.v1beta1.GenericAuthorization" and a.get("msg") == WDRAW_URL:
                r["claim"] = True
                if e is not None: r["exp_ts"] = min(e, r.get("exp_ts") or e)
            elif t == "/cosmos.staking.v1beta1.StakeAuthorization" and a.get("authorization_type") == "AUTHORIZATION_TYPE_DELEGATE":
                cap = a.get("max_tokens")
                r["stake"] = {"allow": (a.get("allow_list") or {}).get("address") or [],
                              "deny": (a.get("deny_list") or {}).get("address") or [],
                              "cap": int(cap["amount"]) if cap and cap.get("denom") == "uatone" else None}
                if e is not None: r["exp_ts"] = min(e, r.get("exp_ts") or e)
        key = d.get("pagination", {}).get("next_key")
        if not key: break
    return {k: v for k, v in out.items() if v.get("claim") and v.get("stake")}

def gas_price():
    """the uphoton a gas the signer pays: the chain's live x/dynamicfee price times its 2x headroom (2026-10-09; was a
    fixed 0.25, 25 times the floor), 0.25 when the price cannot be read"""
    try: return float(get("/cosmos/dynamicfee/v1/gas_price/uphoton")["price"]["amount"]) * 2
    except Exception: return 0.25

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
    # where the rewards go (operator, 2026-10-01): poured onto the shelf, as Autopilot's moves are - from the smallest
    # validator up (the last EDGE left out, never the largest fifth), each 1 ATONE under the one above, so a restake never
    # passes a validator and many restakes in one run spread instead of piling onto one (until 2026-10-01: all onto
    # the single highest-APR validator). An older DELEGATE grant that names validators keeps to them, and a validator
    # its grant denies is never picked (the chain would refuse it; audit 2026-09-30). At most RS_LEGS validators:
    # past that, fewer rewards are claimed now and the rest at the next run
    allow, deny = set(rg["stake"]["allow"] or []), set(rg["stake"].get("deny") or [])
    ranked = sorted(vals.values(), key=lambda v: -v["t"])
    def ok(v): return (not allow or v["op"] in allow) and v["op"] not in deny
    def room(amount):
        """(2026-10-09) Autopilot's pours leave the shelf a staircase 1 ATONE a step (20 validators wide that day): rising
        from its bottom lifts every step, more legs than RS_LEGS, and every restake was skipped. Then the rewards go where
        there is room without lifting anyone: the lowest-ranked first, each up to 1 ATONE under the one above it (the
        staircase's top step had 837 ATONE of room). No validator passes another, so no rank changes"""
        s = [int(v["t"]) for v in ranked]; add, left = {}, int(amount)
        for i in range(len(ranked) - 1 - EDGE, top(len(ranked)) - 1, -1):
            if left <= 0 or len(add) >= RS_LEGS: break
            x = min(left, s[i - 1] - GAP - s[i]) if ok(ranked[i]) else 0
            if x >= 1: add[ranked[i]["op"]] = x; left -= x
        return add
    while True:
        stake = rewards - send
        add = fill(ranked, lambda op: vals[op]["t"], stake, ok, min_leg=1, step=GAP) if stake > 0 else {}
        # what the shelf cannot take (a grant's list leaves too little room) would pass a validator: claim less
        fits = len(add) <= RS_LEGS and stake - sum(add.values()) < GAP // 2
        if not fits and stake > 0:
            add = room(stake); fits = bool(add) and stake - sum(add.values()) < 1
        if fits or len(claim) <= 1: break
        claim.pop(); rewards = sum(a for a, v in pend if v in claim)
    if not add or not fits: out["skip"] = "no validator to stake on"; return out
    if rewards < MIN_RESTAKE * 1e6: out["rewards"] = rewards; out["skip"] = "below %g ATONE" % MIN_RESTAKE; return out
    out["rewards"] = rewards
    # every claimed uatone is staked: what the level search leaves (a few uatone) goes to the smallest leg, far
    # inside its 1 ATONE gap
    pos = {v["op"]: i for i, v in enumerate(ranked)}
    order = sorted(add, key=lambda o: pos[o])                     # the shelf's top first
    add[order[-1]] += int(stake - sum(add.values()))
    legs = [{"validator": op, "amount": int(add[op])} for op in order]
    br = sum(rate_after(m, vals[l["validator"]]["t"], vals[l["validator"]]["c"], l["amount"]) * l["amount"] for l in legs) / stake
    out.update({"claim": claim, "stake": legs, "send": int(send), "rate": br,
                "fee_uphoton": int((120000 + 60000 * (len(claim) + 1 + len(legs))) * gas_price())})
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
    except Exception as e:
        return {"error": "network: %s" % e}      # recorded as a failure, never an escape past the restake row (red team 2026-10-01)

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
            if ok:
                RUN["rs_done"] += 1; RUN["rs_txs"].append(r.get("txhash")); RUN["rs_rewards"] += int(p["rewards"]); RUN["rs_staked"] += int(amt)
                RUN["rs_list"].append((granter, int(amt), [s["validator"] for s in p["stake"]], r.get("txhash")))
                RUN["txinfo"][r.get("txhash")] = {"at": int(time.time()), "granter": granter, "msgs": len(p["claim"]) + len(p["stake"]), "uatone": int(amt)}
            else:
                RUN["rs_failed"] += 1; RUN["rs_fail"].append((granter, classify(r)[1]))
                # (red team 2026-10-01) a broadcast that failed still counts in the day and its fee in the budget; a grant
                # or stake that is gone holds the wallet 24 hours
                record_failed(c, granter, "restake", classify(r)[2], len(p["stake"]))
                hold_if(c, granter, r.get("error"))
            c.execute("INSERT INTO restake(at, granter, rewards, staked, sent, target, txhash, dry, error) VALUES(?,?,?,?,?,?,?,?,?)",
                      (int(time.time()), granter, p["rewards"], amt, p["send"], p["stake"][0]["validator"], r.get("txhash") if ok else None, 0,
                       None if ok else json.dumps(r.get("error"))[:500]))
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

# ── the plan: the operator's rule (2026-09-29), with the shelf rise (2026-10-01) ─────────────
# Water poured from the lowest step: the smallest validator (leaving out the last EDGE, the edge of the set) rises
# first, to STEP (300 ATONE since 2026-10-09) under the validator ranked just above it; then the two rise together, each STEP under the
# one above, and so on: a shelf that rises one step at a time and takes the next validator up as it reaches it
# (operator, 2026-10-01: "apply shelf rise"). Nobody passes the validator above, so no rank changes; the largest
# top(n) never take stake. Any validator of the active set may take stake. A source may give all of the wallet's free
# stake and fall in rank, but never below the top of the shelf it pours into (operator, 2026-10-01: "never below
# shelf, otherwise source rank doesn't matter"); stake on the smallest bottom(n) never moves out. Nothing is offered while
# any of the delegator's stake cools down, so the offer comes back every 21 days, when the last move's cooldown clears.
# fixed in code, as the rest of the operator's rule: no env value can change them at launch
# both scale with the set (2026-10-01: sized for 100, they left nothing to do on testnet's 44): the largest fifth never
# take stake (mainnet: 20, destinations ranks 21 to 97 of 100; the signer's top()), and stake on the smallest 34% never
# moves out (mainnet: 34). Integer arithmetic, so the page and the signer round the same way
def top(n): return n // 5
def bottom(n): return (n * 34 + 50) // 100
EDGE = 3            # the last 3 are left out (operator, 2026-09-30)
GAP = 1_000_000     # 1 ATONE between neighbours: a tie would let the chain's tie-break swap the two
STEP = 300_000_000  # Autopilot fills each validator to 300 ATONE under the one above (operator, 2026-10-09; was 1 ATONE):
                    # the room left is where Restake stakes, as a 1-ATONE staircase had none (no restake ran 10-09 12:00)

def fill(ranked, stake, amount, ok, min_leg=MIN_MOVE, step=STEP):
    """the shelf rise: answers {op: added}. ranked is largest first; stake(op) the stake as it stands; ok(v) whether v
    may take any. A validator that may not (a source, a refused pair, a grant's list) is a fixed step: the shelf below
    it rises to `step` under it, then the pour carries on above it. Autopilot pours with STEP, Restake with GAP"""
    n = len(ranked); add = {}; left = int(amount); TOP = top(n)
    s = [int(stake(v["op"])) for v in ranked]
    i = n - 1 - EDGE
    while i >= TOP and left >= GAP:
        if not ok(ranked[i]): i -= 1; continue
        b0 = i                                         # the segment: b0 up to the first fixed step (or TOP)
        while i - 1 >= TOP and ok(ranked[i - 1]): i -= 1
        k0 = i; i -= 1                                 # ranked[k0 - 1] is a fixed step, or rank TOP
        def cost(k, L): return sum(max(0, L - (j - k) * step - s[j]) for j in range(k, b0 + 1))
        k = b0
        while True:
            lmax = s[k - 1] - step                     # the shelf's top stays `step` under the one above it
            if cost(k, lmax) >= left or k == k0: break
            k -= 1                                     # it reached ranked[k - 1]: that one joins the shelf
        hi = lmax; lo = min(s[k], hi)                  # the highest level the amount pays for, never past lmax
        if cost(k, hi) <= left: lo = hi
        else:
            while lo < hi:
                mid = (lo + hi + 1) // 2
                if cost(k, mid) <= left: lo = mid
                else: hi = mid - 1
        for j in range(k, b0 + 1):
            x = lo - (j - k) * step - s[j]
            if x > 0: add[ranked[j]["op"]] = x; left -= x
    # dust is not a move; leaving it out keeps the order, as the gap (1 ATONE) is wider than any dust. A restake has no
    # dust (a delegation spends no pair entry): it passes min_leg=1
    return {op: x for op, x in add.items() if x >= min_leg}

def ranks_kept(ranked, moves):
    """the plan's own proof, with every move applied: every validator but the plan's sources still stands where it
    stood among the others (above the one under it, never level unless they were level before), and every source in
    the set stays at least 1 ATONE above the highest stake any destination reaches - a source may fall in rank, never
    below the shelf (operator, 2026-10-01)"""
    d, srcs = {}, set()
    for x in moves:
        d[x["src"]] = d.get(x["src"], 0) - x["amount"]; d[x["dst"]] = d.get(x["dst"], 0) + x["amount"]; srcs.add(x["src"])
    rest = [v for v in ranked if v["op"] not in srcs]
    new = [v["t"] + d.get(v["op"], 0) for v in rest]
    for j in range(1, len(rest)):
        if new[j - 1] < new[j] or (rest[j - 1]["t"] > rest[j]["t"] and new[j - 1] <= new[j]): return False
    dsts = {x["dst"] for x in moves}
    shelf = max(v["t"] + d.get(v["op"], 0) for v in ranked if v["op"] in dsts)
    return all(v["t"] + d[v["op"]] >= shelf + GAP for v in ranked if v["op"] in srcs)

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
    bset = {v["op"] for v in ranked[max(0, n - bottom(n)):]}
    src = []
    # all the free stake may go: the floor (never below the shelf) is set in the rounds below, once the shelf is known
    for r in sorted((r for r in rows if r["free"] > 0 and r["op"] not in bset), key=lambda r: -r["free"]):
        if r["free"] >= MIN_MOVE: src.append({"op": r["op"], "give": int(r["free"]), "rate": r["rate"]})
    if not src: return None
    rate_src = {x["op"]: x["rate"] for x in src}
    # any validator of the active set may take stake (operator, 2026-09-30): no uptime test, and a tombstoned validator
    # never returns to the set, so there is none to exclude; an older grant's validator list still binds
    def listed(v): return (g["allow"] is None or v["op"] in g["allow"]) and v["op"] not in g["deny"]
    used = pairs_used(reds)
    def dst_rates(ms):
        mv_ = {}
        for x in ms: mv_[x["dst"]] = mv_.get(x["dst"], 0) + x["amount"]
        return {op: rate_after(m, vals[op]["t"], vals[op]["c"], a) for op, a in mv_.items()}
    def moves_for(srcs, amount, ok, rk):
        add = fill(rk, stake, amount, ok)
        at = {v["op"]: i for i, v in enumerate(rk)}
        # sources fill destinations in turn, smallest validator first: at most S + D - 1 moves
        out, short, si, left = [], set(), 0, [dict(x) for x in srcs]
        for op in sorted(add, key=lambda o: -at[o]):
            need = add[op]
            while need > 0 and si < len(left):
                s_ = left[si]; x = min(need, s_["give"])
                if used.get((s_["op"], op), 0) < 7: out.append({"src": s_["op"], "dst": op, "amount": int(x)})
                else: short.add(op)                   # a pair that already holds 7 unmatured entries
                s_["give"] -= x; need -= x
                if s_["give"] <= 0: si += 1
        return out, short
    # the shelf is settled in rounds: a destination a full pair would leave short, or one that pays too little after
    # its share for even the best-placed source, becomes a fixed step; a source that would end below the shelf's top
    # gives less (its floor: 1 ATONE over the shelf); a source the shelf cannot lift by more than MIN_GAIN_APR stays
    # where it is. Each round only adds a step, lowers a give or drops a source, so it ends, and every move left on
    # its own earns more than 5 APR points (audit 2026-09-30) on a shelf with no hole in it
    fixed = set(); moves = []
    for _ in range(4 * n + 4 * len(src) + 10):
        if not src: return None
        budget = sum(x["give"] for x in src)
        if g["cap"] is not None: budget = min(budget, g["cap"])
        gone = {x["op"]: x["give"] for x in src}      # the cautious bound: every source counted as gone
        def stake(op, gone=gone): return vals[op]["t"] - gone.get(op, 0)
        # the set as it stands once the sources have given: a source that falls in rank is placed where it falls
        rk = sorted(ranked, key=lambda v: -stake(v["op"]))
        # a source is never a destination of its own plan: it is a fixed step while it gives
        def ok(v, gone=gone): return listed(v) and v["op"] not in fixed and v["op"] not in gone
        # more moves than the day allows: move less, never cut a plan (a cut would leave a hole in the shelf)
        moves, short = moves_for(src, budget, ok, rk)
        while len(moves) > room and budget > MIN_MOVE:
            budget = int(budget * 0.85); moves, short = moves_for(src, budget, ok, rk)
        if not moves or len(moves) > room: return None
        if short: fixed |= short; continue
        # the floor: no source in the set ends below the shelf's top + 1 ATONE
        recv, sent = {}, {}
        for x in moves:
            recv[x["dst"]] = recv.get(x["dst"], 0) + x["amount"]; sent[x["src"]] = sent.get(x["src"], 0) + x["amount"]
        shelf = max(vals[op]["t"] + a for op, a in recv.items())
        low = [x for x in src if x["op"] in vals and vals[x["op"]]["t"] - sent.get(x["op"], 0) < shelf + GAP]
        if low:
            for x in low: x["give"] = max(0, int(vals[x["op"]]["t"] - shelf - GAP))
            src = [x for x in src if x["give"] >= MIN_MOVE]; continue
        rate_dst = dst_rates(moves)
        best = min(rate_src[x["src"]] for x in moves)
        weak = {op for op, r in rate_dst.items() if r - best <= MIN_GAIN_APR}
        if weak: fixed |= weak; continue
        floor = min(rate_dst.values())
        high = [x for x in src if rate_src[x["op"]] >= floor - MIN_GAIN_APR]
        if high:
            top = max(high, key=lambda x: rate_src[x["op"]])
            src = [x for x in src if x is not top]; continue
        break
    else: return None
    # a source's last piece under 1 ATONE is no move: the shelf it leaves short by less than the 1 ATONE gap keeps its order
    moves = [x for x in moves if x["amount"] >= MIN_MOVE]
    if not moves: return None
    if not ranks_kept(ranked, moves):
        log("plan refused: it would change a rank (%s)" % g.get("granter", "?")); return None
    rate_dst = dst_rates(moves)
    for mv in moves: mv["gain"] = mv["amount"] * (rate_dst[mv["dst"]] - rate_src[mv["src"]]) / 1e6
    # the rest of the wallet (operator, 2026-10-08): stake it already has on a destination earns that destination's new,
    # lower rate, and stake that stays on a source earns that source's new, higher rate. Each validator's effect is
    # shared over the moves into or out of it, so the moves' gains (and the public totals that sum them) are the
    # wallet's true change. The app's planner (bin/app.js __planRank) does the same arithmetic.
    sent, recv = {}, {}
    for mv in moves:
        sent[mv["src"]] = sent.get(mv["src"], 0) + mv["amount"]; recv[mv["dst"]] = recv.get(mv["dst"], 0) + mv["amount"]
    for r in rows:
        op, v = r["op"], vals.get(r["op"])
        if not v or (op not in sent and op not in recv): continue
        if op in recv: stays, new, by, key = r["x"], rate_dst[op], recv[op], "dst"
        else: stays, new, by, key = r["x"] - sent[op], rate_after(m, v["t"], v["c"], -sent[op]), sent[op], "src"
        rest = stays * (new - r["rate"]) / 1e6
        for mv in moves:
            if mv[key] == op: mv["gain"] += rest * mv["amount"] / by
    gain = sum(mv["gain"] for mv in moves)
    after = now + gain * 1e6 / total
    moved_u = sum(mv["amount"] for mv in moves)
    lift = gain * 1e6 / moved_u
    # only a move whose true gain is worth more than MIN_GAIN_APR (5 APR points) on the stake that moves: otherwise the wallet is at its best
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
            + c.execute("SELECT count(*) FROM restake WHERE granter=? AND at>? AND dry=0 AND txhash IS NOT NULL", (granter, t)).fetchone()[0]
            # (red team 2026-10-01) and every broadcast that did not land as a success: the signer pays for those too
            + c.execute("SELECT coalesce(sum(msgs), 0) FROM failed_tx WHERE granter=? AND at>?", (granter, t)).fetchone()[0])

def record_failed(c, gr, service, h, msgs):
    """(red team 2026-10-01) a broadcast that did not land as a success: in the wallet's day (moves_today) and, through
    tx_log at the run's end, in its fee budget. Without a txhash nothing was broadcast and nothing is counted"""
    if not h: return
    c.execute("INSERT OR IGNORE INTO failed_tx VALUES(?,?,?,?,?)", (h, int(time.time()), gr, service, int(msgs or 1))); c.commit()
    k = "ap_bad" if service == "autopilot" else "rs_bad"
    if h not in RUN.get(k, []) and h not in RUN.get(k[:3] + "txs", []):
        RUN.setdefault(k, []).append(h)
        RUN.setdefault("txinfo", {}).setdefault(h, {"at": int(time.time()), "granter": gr, "msgs": int(msgs or 1), "uatone": 0})

def hold_if(c, gr, err):
    """(red team 2026-10-01) a failure that says the grant or the stake is gone (authorization not found or expired, no
    or not enough delegation, no validator, a redelegation in progress): the wallet waits HOLD_S, whatever it grants
    meanwhile. Answers the hold's reason, or None"""
    text = (err if isinstance(err, str) else json.dumps(err)).lower()
    w = next((w for w in HOLD_WORDS if w in text), None)
    if not w: return None
    why = "the grant is gone" if ("authorization" in w or "grant" in w) else "the stake changed"
    now = int(time.time())
    c.execute("INSERT OR REPLACE INTO hold VALUES(?,?,?,?,?)", (gr, now + HOLD_S, why, now, text[:300])); c.commit()
    log("hold granter=%s for %d h: %s (%s)" % (gr, HOLD_S // 3600, why, w))
    return why

def fee_hold(c, gr):
    """(red team 2026-10-01) fees paid for this wallet in the last 24 hours (tx_log, any code) over FEE_DAY: held until
    enough of them age out of the window. Alerts ops once per hold. Answers (why, until) or None"""
    now = int(time.time())
    rows = c.execute("SELECT at, fee_uphoton FROM tx_log WHERE granter=? AND at>? AND fee_uphoton IS NOT NULL ORDER BY at",
                     (gr, now - 86400)).fetchall()
    tot = sum(f for _, f in rows)
    if tot <= FEE_DAY: return None
    left, until = tot, now
    for at, f in rows:
        left -= f; until = at + 86400
        if left <= FEE_DAY: break
    row = c.execute("SELECT at FROM alert_sent WHERE granter=? AND k='fee_hold'", (gr,)).fetchone()
    if not row or row[0] <= now:
        alert("warn", "Autopilot wallet held: fees over %g PHOTON a day: %s" % (FEE_DAY / 1e6, short(gr)),
              "Its transactions cost more than the daily budget in the last 24 hours. Nothing is signed for it until "
              + time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(until)) + ".",
              {"Delegator": gr, "Fees, 24 hours": "{:,.4f} PHOTON".format(tot / 1e6), "Transactions": len(rows)})
        c.execute("INSERT OR REPLACE INTO alert_sent VALUES(?, 'fee_hold', ?)", (gr, until)); c.commit()
    return "fees over the daily budget", until

def wallet_hold(c, gr, exp=None, need=None):
    """(red team 2026-10-01) why nothing is signed for this wallet now, and until when: (why, until) or None. A hold after
    a failure, the fee budget, a grant ending within EXP_MIN_S (exp: its end, epoch s), and with need, no room left in
    the day for that many more (Autopilot's plan fits the room itself)"""
    now = int(time.time())
    row = c.execute("SELECT until, why FROM hold WHERE granter=? AND until>?", (gr, now)).fetchone()
    if row: return "held 24 hours: " + row[1], row[0]
    f = fee_hold(c, gr)
    if f: return f
    if exp is not None and exp - now < EXP_MIN_S: return "the grant ends within 24 hours", exp
    if need and moves_today(c, gr) + need > MAX_MOVES_DAY:
        t = now - 86400
        first = c.execute("SELECT min(at) FROM (SELECT at FROM move WHERE granter=? AND at>? AND dry=0 UNION ALL SELECT at FROM restake WHERE granter=?"
                          " AND at>? AND dry=0 AND txhash IS NOT NULL UNION ALL SELECT at FROM failed_tx WHERE granter=? AND at>?)", (gr, t, gr, t, gr, t)).fetchone()[0]
        return "daily move limit", (first or now) + 86400
    return None

HELD = {}
def held_log(gr, svc, h):
    """a hold is logged when it starts or its reason changes, not every tick"""
    k, v = (gr, svc), (h[0] if h else None)
    if HELD.get(k) != v:
        if v: log("%s held granter=%s: %s, until %s" % (svc, gr, v, time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(h[1]))))
        elif k in HELD: log("%s hold lifted granter=%s" % (svc, gr))
        HELD[k] = v

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
            RUN["txinfo"][r.get("txhash")] = {"at": now, "granter": gr, "msgs": len(part), "uatone": sum(int(e["amount"]) for e in part)}
            RUN["ap_uatone"] += sum(int(e["amount"]) for e in part); RUN["ap_gain"] += sum(float(e.get("gain", 0)) for e in part)
            sent.append(r.get("txhash"))
        else:
            moves = []
    ok = not moves
    kind, why, h = ("ok", "", r.get("txhash")) if ok else classify(r)
    held = None
    if not ok:
        # (red team 2026-10-01) every broadcast counts: a failed one (a code != 0, a 502 with its txhash, one sent and not
        # yet seen) is in the wallet's day and its fee in the wallet's budget; a grant or stake gone holds it 24 hours
        record_failed(c, gr, "autopilot", h, min(len(moves), MAX_MOVES_TX))
        held = hold_if(c, gr, r.get("error"))
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
    RUN["ap_failed"] += 1; RUN["ap_fail"].append((gr, why or kind))
    p = dict(p, moves=moves)                       # what is left is what the retry or the next run is about
    if kind == "settle":
        c.execute("DELETE FROM retry WHERE granter=?", (gr,)); c.commit()
        f["Chain said"] = why
        if held: f["Held"] = "24 hours: " + held
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
    if seen["code"] == 0:
        c.execute("DELETE FROM failed_tx WHERE txhash=?", (seen["txhash"],))     # it landed: its moves count it (red team 2026-10-01)
    if seen["code"] == 0 and seen["moves"] and not c.execute("SELECT 1 FROM move WHERE txhash=?", (seen["txhash"],)).fetchone():
        record_moves(c, gr, seen["moves"], seen["txhash"], now)
        c.execute("INSERT INTO applied VALUES(?,?,?,?,?,?,?,?,?)", (now, gr, plan_id({"moves": seen["moves"]}), "auto", seen["txhash"], 0, 1, None, 0))
        RUN["ap_wallets"].add(gr); RUN["ap_moves"] += len(seen["moves"]); RUN["ap_txs"].append(seen["txhash"])    # in the run summary
        RUN["ap_uatone"] += sum(int(e["amount"]) for e in seen["moves"])
    elif seen["code"] != 0:
        raw = str(seen.get("raw") or "")
        log("tx %s for %s landed with code %s: %s" % (seen["txhash"], gr, seen["code"], raw[:200]))
        kind, why, _ = classify({"error": "code %d (codespace: %s) %s" % (seen["code"], seen.get("codespace") or "sdk", raw)})
        record_failed(c, gr, "autopilot", seen["txhash"], len(moves or seen["moves"]) or 1)     # it paid (red team 2026-10-01)
        hold_if(c, gr, raw)
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
    led = ledger()                                    # once per tick (red team 2026-10-01)
    gs.sort(key=lambda g: granted_at(g["granter"], c, led))
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
            # (red team 2026-10-01) held: a failure that said the grant or stake is gone (a re-grant does not lift it), the
            # fee budget, a grant ending within 24 hours, a full day. The report says why
            hold = wallet_hold(c, gr, g.get("exp_ts"))
            held_log(gr, "autopilot", hold)
            if hold:
                due = False; RUN["ap_held"] += 1
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
            if hold: rep["hold"] = {"why": hold[0], "until": int(hold[1])}
            else: rep.pop("hold", None)
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
            # (red team 2026-10-01) the same holds as Autopilot, with the end of Restake's own two grants; not marked as
            # run, so it goes ahead in this slot once the hold lifts
            hold = wallet_hold(c, granter, rgs[granter].get("exp_ts"), need=1)
            held_log(granter, "restake", hold)
            if hold:
                RUN["rs_held"] += 1
                path = os.path.join(REPORTS, granter + ".json")
                try: rep = json.load(open(path))
                except Exception: rep = {"granter": granter, "strategy": "restake"}
                done = c.execute("SELECT count(*), coalesce(sum(staked), 0), max(at) FROM restake WHERE granter=? AND dry=0 AND txhash IS NOT NULL", (granter,)).fetchone()
                rep["restake"] = {"skip": hold[0], "until": int(hold[1]), "live": RESTAKE and not dry, "count": done[0], "total": done[1], "last_at": done[2]}
                rep["checked"] = int(time.time()); rep["dry"] = dry
                report(granter, rep)
                continue
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
        report("_status", {"grantee": GRANTEE, "checked": int(time.time()), "grants": len(gs), "dry": DRY, "photon": photon, "every": EVERY,
                           "impact": impact(c)})
        atone = next((int(b["amount"]) for b in s.get("balances", []) if b["denom"] == "uatone"), 0)
        RUN["photon"] = photon
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
    log("net %s, api %s, state %s, reports %s" % (NET, API, STATE, REPORTS))       # the effective paths (red team 2026-10-01)
    try: tx_backfill(c)
    except Exception as e: log("tx_log backfill failed: %s" % e)
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
