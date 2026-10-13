#!/usr/bin/env python3
"""Per-validator downtime alerts for the AtomOne app.

Deliberately isolated from GATA's own monitoring: its own bot token, its own
service account, its own store. It reads the index through the read-only
atomone_app_ro role and writes nothing back to it. Nothing here shares a token,
a file or a unit with the ops alerting path - a crash loop in this process
cannot touch it.

A Telegram token allows exactly ONE getUpdates consumer, which is the whole
reason this cannot live on @ChainsPingBot.
"""
import calendar, html, json, os, re, sqlite3, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

TOKEN  = os.environ.get("TG_BOT_TOKEN", "").strip()
DSN    = os.environ["ATOMONE_APP_DSN"]
# argv is world-readable through /proc while psql runs, so the password travels
# in the environment (owner-readable only) rather than on the command line.
_u     = urllib.parse.urlparse(DSN)
PGENV  = dict(os.environ)
if _u.password:
    PGENV["PGPASSWORD"] = urllib.parse.unquote(_u.password)
    DSN_SAFE = _u._replace(netloc="{}@{}{}".format(
        _u.username, _u.hostname, ":%d" % _u.port if _u.port else "")).geturl()
else:
    DSN_SAFE = DSN
CHAIN  = os.environ.get("CHAIN_ID", "atomone-1")
DATA   = os.environ.get("DATA_JSON", "/srv/atomone-app/web/data.json")
DB     = os.environ.get("BOT_DB", "/srv/atomone-app/bot/subs.db")
IDFILE = os.environ.get("BOT_ID_FILE", "/srv/atomone-app/state/bot.json")
PAGE   = os.environ.get("PAGE_URL", "https://atomone.gatahub.zone/")
# how many of the most recent blocks decide the verdict. All missed -> down,
# all signed -> recovered, anything between leaves the state alone, so a
# validator flapping on the boundary cannot spam a subscriber.
WINDOW = int(os.environ.get("ALERT_WINDOW", "10"))
CHECK  = int(os.environ.get("CHECK_SECONDS", "60"))
# a rank alert needs a move of this many places from the rank at the last alert, so two
# validators a few ATONE apart swapping places on every rebuild cannot spam anyone
RANK_STEP = int(os.environ.get("RANK_STEP", "2"))
# the index is the only feed: while its newest block is older than this, signing verdicts
# wait. Alerting on a stalled index is Uptime Kuma's job (check_indexer.sh, per chain), so
# this only logs the change.
STALE_S = int(os.environ.get("STALE_SECONDS", "300"))
STATE  = os.path.dirname(IDFILE)
# the validator watch (valwatch.py, the Discord path) writes each active validator's missed-block
# counter from x/slashing every minute; the "half the window" alert reads it rather than count
# 10,000 heights itself, so Telegram and Discord go critical on the same number
VALWATCH = os.environ.get("VALWATCH_JSON", os.path.join(STATE, "valwatch-mainnet.json"))
BACKUP = os.path.join(STATE, "subs.backup.db")
# a wallet's own alerts (2026-10-01): what the keeper did for it, read from the report it writes per wallet (the page
# reads the same file); the explorer the messages link to
REPORTS = os.environ.get("KEEPER_REPORTS", "/srv/atomone-app/web/pilot")
EXPLORER = os.environ.get("EXPLORER_TX", "https://explorer.gatahub.zone/atomone-1/txs/")
API    = "https://api.telegram.org/bot" + TOKEN + "/"
# governor alerts (2026-10-12) read the chain's own REST: governors, open proposals, a governor's vote on each
CHAIN_API = os.environ.get("CHAIN_API", "http://127.0.0.1:3999").rstrip("/")
GCHECK    = int(os.environ.get("GOV_CHECK_SECONDS", "300"))
REMIND_S  = int(os.environ.get("GOV_REMIND_SECONDS", str(24 * 3600)))   # "has not voted" this long before the end

if not TOKEN:
    print("atomone-app-bot: TG_BOT_TOKEN is empty - nothing to poll", file=sys.stderr)
    sys.exit(78)                                    # EX_CONFIG


def log(m): print("atomone-app-bot: " + m, flush=True)


def tg(method, **params):
    body = urllib.parse.urlencode(params).encode()
    req  = urllib.request.Request(API + method, data=body)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            d = json.loads(r.read())
        return d.get("result") if d.get("ok") else None
    except Exception as e:
        log("telegram %s: %s" % (method, e))
        return None


def sql(q, args=()):
    """psql rather than a driver: no third-party dependency on the box, and the
    query volume here is a handful of rows a minute."""
    cmd = ["psql", DSN_SAFE, "-tAF", "\x1f", "-v", "ON_ERROR_STOP=1", "-c", q % args]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=60, env=PGENV)
    if p.returncode:
        log("sql: " + p.stderr.strip()[:200]); return None
    return [l.split("\x1f") for l in p.stdout.strip().split("\n") if l]


def store():
    c = sqlite3.connect(DB)
    c.execute("""CREATE TABLE IF NOT EXISTS sub(chat INTEGER, op TEXT, made INTEGER,
                 PRIMARY KEY(chat, op))""")
    c.execute("""CREATE TABLE IF NOT EXISTS vstate(op TEXT PRIMARY KEY, down INTEGER,
                 since INTEGER)""")
    # added 2026-09-17 with the alert chooser; existing rows default to signing only
    for tbl, col, decl in (("sub", "flags", "TEXT DEFAULT 'd'"),
                           ("vstate", "rank", "INTEGER"),
                           ("vstate", "apr", "REAL"),
                           ("vstate", "jail", "INTEGER"),
                           # added 2026-09-27: the moniker, so a validator that left the set
                           # (jailed) can still be named; the rank at the last rank alert; and
                           # the height of the newest jailing already announced
                           ("vstate", "m", "TEXT"),
                           ("vstate", "rank_ref", "INTEGER"),
                           ("vstate", "jail_h", "INTEGER"),
                           # added 2026-09-27: in the half-window critical zone (NULL = not yet seen)
                           ("vstate", "half", "INTEGER"),
                           # added 2026-10-08: jailed and not yet back in the set (1), so a user hears it return
                           ("vstate", "out", "INTEGER")):
        try:
            c.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} {decl}")
        except sqlite3.OperationalError:
            pass
    c.execute("CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT)")
    # the consensus address of each watched validator, kept for when it leaves the page's data
    c.execute("CREATE TABLE IF NOT EXISTS vchex(op TEXT PRIMARY KEY, chex TEXT)")
    # a wallet's own alerts (2026-10-01): who watches which wallet, and what was last announced for it (the newest
    # Autopilot move's time, Restake's running total), so each move and restake is told once
    c.execute("CREATE TABLE IF NOT EXISTS wsub(chat INTEGER, addr TEXT, made INTEGER, PRIMARY KEY(chat, addr))")
    # what the chat chose for that wallet: a = Autopilot moves, r = Restake (the app's card ticks them)
    try: c.execute("ALTER TABLE wsub ADD COLUMN flags TEXT DEFAULT 'ar'")
    except sqlite3.OperationalError: pass
    c.execute("CREATE TABLE IF NOT EXISTS wstate(addr TEXT PRIMARY KEY, mv_at INTEGER, rs_total INTEGER)")
    # governors (2026-10-12): who watches which governor and what was last told about it
    c.execute("CREATE TABLE IF NOT EXISTS gsub(chat INTEGER, gov TEXT, made INTEGER, flags TEXT DEFAULT 'vms', PRIMARY KEY(chat, gov))")
    c.execute("CREATE TABLE IF NOT EXISTS gstate(gov TEXT PRIMARY KEY, m TEXT, active INTEGER, told TEXT, reminded TEXT)")
    c.commit()
    return c


def meta_get(c, k, d=None):
    r = c.execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone()
    return r[0] if r else d


def meta_set(c, k, v):
    c.execute("INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",
              (k, str(v)))
    c.commit()


def vals():
    """operator -> {moniker, cons hex, rank} straight from the page's own data,
    so the bot and the page can never disagree about who is who."""
    try:
        D = json.load(open(DATA))
    except Exception as e:
        log("data.json: %s" % e); return {}
    return {v["op"]: {"m": v["m"], "chex": v["chex"], "rank": v["rank"], "vid": v.get("vid"),
                      "apr": v.get("apr"), "jail": v.get("jail", 0)}
            for v in D["validators"] if v.get("op") and v.get("chex")}


def missed_recent(chex, known):
    """Missed blocks among the WINDOW heights ending at `known`.

    Who missed height h is written with block h+1 (it travels in that block's
    last commit), so the newest block in the index never has its signatures yet.
    `known` is therefore the tip minus one; counting up to the tip made the
    window nine real heights long and "all 10 missed" impossible."""
    # chex reaches SQL by interpolation; it is a consensus address from our own
    # data.json, but assert the shape rather than trust the provenance
    if not re.fullmatch(r"[0-9A-Fa-f]{40}", chex or ""):
        return None
    r = sql("""SELECT count(*) FROM missed_signature
               WHERE chain_id='%s' AND cons_addr='%s' AND height > %d AND height <= %d""",
            (CHAIN, chex.upper(), known - WINDOW, known))
    return int(r[0][0]) if r else None


def tip():
    """(newest height in the index, its age in seconds)"""
    r = sql("""SELECT height, extract(epoch FROM now() - time)::int FROM block
               WHERE chain_id='%s' ORDER BY height DESC LIMIT 1""", (CHAIN,))
    try:
        return int(r[0][0]), int(r[0][1])
    except Exception:
        return None, None


CS = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
def _polymod(v):
    g = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]; c = 1
    for x in v:
        b = c >> 25; c = (c & 0x1ffffff) << 5 ^ x
        for i in range(5): c ^= g[i] if (b >> i) & 1 else 0
    return c
def valcons(chex):
    """the bech32 consensus address slash_event.cons_addr uses, from the hex one"""
    data, acc, bits = [], 0, 0
    for b in bytes.fromhex(chex):
        acc = (acc << 8) | b; bits += 8
        while bits >= 5: bits -= 5; data.append((acc >> bits) & 31)
    if bits: data.append((acc << (5 - bits)) & 31)
    hrp = "atonevalcons"
    ex = [ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp]
    pm = _polymod(ex + data + [0] * 6) ^ 1
    return hrp + "1" + "".join(CS[d] for d in data + [(pm >> 5 * (5 - i)) & 31 for i in range(6)])


WALERTS = {"a": ("Autopilot", "each move: how much, from where, ATONE a year"), "r": ("Restake", "each restake: the rewards staked")}


def wallet(arg):
    """`w_<the 38 characters after atone1>[_<a and/or r>]` from the app's wallet card: (the full address, its checksum
    verified, the alerts chosen - both when the link names none), or (None, "")"""
    m = re.fullmatch(r"w_([02-9ac-hj-np-z]{38})(?:_([ar]{1,2}))?", arg or "")
    if not m: return None, ""
    hrp, data = "atone", [CS.index(ch) for ch in m.group(1)]
    if _polymod([ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp] + data) != 1: return None, ""
    return "atone1" + m.group(1), "".join(f for f in "ar" if f in (m.group(2) or "ar"))


# ── a governor's alerts (operator, 2026-10-12: "alert in the governor popup, like the validator one") ─────────────────
GALERTS = {"v": ("It votes", "each vote it casts, and on which proposal"),
           "m": ("It has not voted, a day before the end", "so you can still vote yourself"),
           "s": ("Its status changes", "active or inactive")}
GVOTE = {"VOTE_OPTION_YES": "Yes", "VOTE_OPTION_NO": "No", "VOTE_OPTION_ABSTAIN": "Abstain"}
GSHORT = {"v": "votes", "m": "not-voted reminder", "s": "status"}


def _bech(hrp, data):
    pm = _polymod([ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp] + data + [0] * 6) ^ 1
    return hrp + "1" + "".join(CS[d] for d in data + [(pm >> 5 * (5 - i)) & 31 for i in range(6)])


def governor(arg):
    """`g_<the 38 characters after atonegov1>[_<v, m and/or s>]` from the governor card: (the governor address, its
    checksum verified, the alerts chosen - all three when the link names none), or (None, "")"""
    m = re.fullmatch(r"g_([02-9ac-hj-np-z]{38})(?:_([vms]{1,3}))?", arg or "")
    if not m: return None, ""
    hrp, data = "atonegov", [CS.index(ch) for ch in m.group(1)]
    if _polymod([ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp] + data) != 1: return None, ""
    return "atonegov1" + m.group(1), "".join(f for f in "vms" if f in (m.group(2) or "vms"))


def gov_acct(gov):
    """the governor's own account (same key, atone prefix): the address its votes are cast from"""
    data = [CS.index(ch) for ch in gov.split("1", 1)[1][:-6]]
    return _bech("atone", data)


def chain(path, missing=None):
    """GET from the chain's REST; `missing` is returned for a 404 (a vote not cast), None for any other failure"""
    try:
        with urllib.request.urlopen(CHAIN_API + path, timeout=15) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        # "no such vote" comes back as 400 InvalidArgument "voter: ... not found for proposal" on AtomOne, not a 404;
        # that exact answer means missing, any other failure means unknown (never read as "has not voted")
        try: body = e.read().decode("utf-8", "replace")
        except Exception: body = ""
        if e.code == 404 or (e.code == 400 and "not found for proposal" in body): return missing
        log("chain %s: HTTP %s" % (path[:60], e.code)); return None
    except Exception as e:
        log("chain %s: %s" % (path[:60], e)); return None


def gov_state(c, gov):
    r = c.execute("SELECT m, active, told, reminded FROM gstate WHERE gov=?", (gov,)).fetchone()
    if not r: return None
    return {"m": r[0], "active": r[1], "told": json.loads(r[2] or "{}"), "reminded": json.loads(r[3] or "[]")}


def gov_save(c, gov, st):
    c.execute("INSERT INTO gstate(gov, m, active, told, reminded) VALUES(?,?,?,?,?) ON CONFLICT(gov) DO UPDATE SET "
              "m=excluded.m, active=excluded.active, told=excluded.told, reminded=excluded.reminded",
              (gov, st["m"], st["active"], json.dumps(st["told"]), json.dumps(st["reminded"])))


def gov_snapshot():
    """(governors {addr: (moniker, active)}, open proposals [(id, title, end_ts)]) or (None, None) on a failed read"""
    G = chain("/atomone/gov/v1/governors?pagination.limit=500")
    P = chain("/atomone/gov/v1/proposals?proposal_status=2&pagination.limit=50")     # 2 = voting period (the API takes the number)
    if G is None or P is None: return None, None
    gs = {g["governor_address"]: (((g.get("description") or {}).get("moniker") or "").strip() or g["governor_address"][:14],
                                  g.get("status") == "GOVERNOR_STATUS_ACTIVE") for g in G.get("governors", [])}
    ps = []
    for p in P.get("proposals", []):
        t = p.get("voting_end_time") or ""
        try:
            end = calendar.timegm(time.strptime(t[:19], "%Y-%m-%dT%H:%M:%S"))       # the chain writes UTC
        except Exception:
            continue
        ps.append((int(p["id"]), (p.get("title") or "").strip() or "Proposal %s" % p["id"], end))
    return gs, ps


def gov_vote(acct, pid):
    """the governor's vote on an open proposal: its option name, "" when it has not voted, None when unreadable"""
    d = chain("/atomone/gov/v1/proposals/%d/votes/%s" % (pid, acct), missing={})
    if d is None: return None
    o = (((d.get("vote") or {}).get("options") or [{}])[0]).get("option")
    return GVOTE.get(o, "") if o else ""


def gov_until(end):
    h = max(0, int((end - time.time()) // 3600))
    return "%d hour%s" % (h, "" if h == 1 else "s") if h < 48 else "%d days" % (h // 24)


def govcheck(c):
    """One pass over every watched governor: a status change, each vote it casts on an open proposal (told once per
    proposal, again if it changes its vote), and a reminder when an open proposal ends within a day and it has not
    voted. State is kept per governor, so a message goes out once per change, not once per pass."""
    subs = {}
    for gov, chat, fl in c.execute("SELECT gov, chat, flags FROM gsub").fetchall():
        subs.setdefault(gov, []).append((chat, fl or "vms"))
    if not subs: return
    gs, ps = gov_snapshot()
    if gs is None: return
    now = time.time()
    for gov, watchers in subs.items():
        if gov not in gs: continue                     # gone from the chain: nothing to watch until it returns
        m, active = gs[gov]
        st = gov_state(c, gov) or {"m": m, "active": int(active), "told": {}, "reminded": []}
        events = []
        if bool(st["active"]) != active:
            events.append(("s", ("<b>%s</b> is active again.\nIts vote counts for the stakers who follow it." % md(m)) if active else
                                ("<b>%s</b> is now inactive.\nIts vote counts for no one who follows it until it is active again. "
                                 "Vote yourself, or follow another governor." % md(m))))
        acct, open_ids = gov_acct(gov), set()
        for pid, title, end in ps:
            open_ids.add(str(pid))
            v = gov_vote(acct, pid)
            if v is None: continue                     # unreadable this pass: claim nothing
            was = st["told"].get(str(pid))
            if v and v != was:
                events.append(("v", ("<b>%s</b> changed its vote on #%d to <b>%s</b>.\n%s" if was else "<b>%s</b> voted <b>%s</b> on #%d.\n%s")
                               % ((md(m), pid, v, md(title)) if was else (md(m), v, pid, md(title)))
                               + "\nVoting ends in %s. Your own vote, if you cast one, counts instead of its." % gov_until(end)))
                st["told"][str(pid)] = v
            # only while voting is still open: a proposal ending mid-pass is not "not voted" (audit 2026-10-13)
            if not v and now < end - 60 and end - now <= REMIND_S and str(pid) not in st["reminded"]:
                events.append(("m", "<b>%s</b> has not voted on #%d, and voting ends in %s.\n%s\n"
                                    "If you want your stake to count, vote yourself in the app." % (md(m), pid, gov_until(end), md(title))))
                st["reminded"].append(str(pid))
        st["told"] = {k: v for k, v in st["told"].items() if k in open_ids}
        st["reminded"] = [k for k in st["reminded"] if k in open_ids]
        st["m"], st["active"] = m, int(active)
        gov_save(c, gov, st); c.commit()
        for letter, msg in events:
            for chat, fl in watchers:
                if letter in fl:
                    send(chat, msg); time.sleep(0.05)
            log("governor %s: %s" % (m, GALERTS[letter][0]))


def short(a): return a[:10] + "..." + a[-4:]


def report(addr):
    try:
        with open(os.path.join(REPORTS, addr + ".json")) as f: return json.load(f)
    except Exception:
        return None


def wallet_marks(r):
    """what has been announced is everything in the report now: the newest move's time, Restake's total"""
    hist = (r or {}).get("history") or []
    return max([int(h.get("at") or 0) for h in hist] or [0]), int(((r or {}).get("restake") or {}).get("total") or 0)


def slashing():
    """(missed-in-window by valcons, window, the critical line) from the validator watch's
    newest sample; None when the file is missing or its sample is over 10 minutes old"""
    try:
        d = json.load(open(VALWATCH))
        smp = d["samples"][-1]
        if time.time() - smp["t"] > 600 or not d.get("window"):
            return None
        return smp["miss"], int(d["window"]), int(d["window"] * float(d.get("crit_fraction", 0.5)))
    except Exception:
        return None


CHAIN_REST = os.environ.get("CHAIN_REST", "http://127.0.0.1:3999")
_MINSIG = [0, 0.05]
def jail_at(window):
    """missed blocks at which the chain jails: window x (1 - min_signed_per_window), the chain's own parameter,
    re-read hourly; 0.05 (AtomOne's value) until the first read succeeds"""
    if time.time() - _MINSIG[0] > 3600:
        try:
            with urllib.request.urlopen(CHAIN_REST + "/cosmos/slashing/v1beta1/params", timeout=10) as r:
                _MINSIG[1] = float(json.loads(r.read())["params"]["min_signed_per_window"])
            _MINSIG[0] = time.time()
        except Exception:
            pass
    return int(round(window * (1 - _MINSIG[1])))


def last_jail(op, chex):
    """height of the newest jailing of this validator in the index, 0 if none.

    Read from slash_event, not from data.json: the page lists only the active,
    unjailed set, so a validator vanishes from it at the very moment it is
    jailed - which is when this alert matters."""
    if not re.fullmatch(r"atonevaloper1[0-9a-z]{38}", op or ""):
        return None
    cond = "operator='%s'" % op
    if re.fullmatch(r"[0-9A-Fa-f]{40}", chex or ""):
        cond = "(%s OR cons_addr='%s')" % (cond, valcons(chex))
    r = sql("""SELECT coalesce(max(height), 0) FROM slash_event
               WHERE chain_id='%s' AND kind='jailed' AND %s""", (CHAIN, cond))
    try:
        return int(r[0][0])
    except Exception:
        return None


# ── what the page can ask for ───────────────────────────────────────────────
# Keyed by the single letters the deep link carries. Telegram caps a start
# payload at 64 characters and allows only [A-Za-z0-9_-], which is why the
# validator travels as its 40-hex consensus address (an 8-character prefix before
# 2026-10-01, still read when unique) and each alert is one letter rather than a word.
# INVARIANT: every alert states a FACT about a validator the reader already holds.
# It must never name a destination, rank an alternative, or suggest a move. The
# portal shows the same live numbers to everyone at once; a push notification that
# says "go here" would hand whoever reads it first an edge over everyone else - and
# under the 21-day transitive-redelegation lock the latecomers could not undo it.
# Alerts tell you what happened to what you own. Nothing more.
ALERTS = {
    "d": ("Stops signing - misses %d blocks in a row" % WINDOW, "signing"),
    "h": ("Misses half the slashing window",                    "half window"),
    "j": ("Jailed - drops out of the active set",               "jailed"),
    "r": ("Rank changes - moves %d places or more" % RANK_STEP, "rank"),
    "t": ("APR moves ±10% or more",                             "APR ±10%"),
}
APR_STEP = {"t": 0.10}


B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"


def resolve_bits(arg, V):
    """`b_<flags>_<bitmap>` from the stake and redelegate cards: the set as a bitmap over
    each validator's stable number (vid in data.json), six bits per character of the
    alphabet Telegram's start payload allows. One link carries the whole set."""
    if not arg.startswith("b_"):
        return []
    flags, _, bits = arg[2:].partition("_")
    flags = "".join(f for f in flags if f in ALERTS) or "d"
    want = set()
    for k, ch in enumerate(bits):
        c = B64.find(ch)
        if c < 0:
            return []
        for j in range(6):
            if c & (1 << j):
                want.add(6 * k + j)
    by = {v["vid"]: op for op, v in V.items() if v.get("vid") is not None}
    return [(by[n], flags) for n in sorted(want) if n in by]


def by_chex(ident, V, amb=None):
    """The one validator whose consensus address starts with `ident` (6 hex at least; the
    full 40 since 2026-10-01). A prefix two validators share names neither: a ground key
    could otherwise catch a reader's subscription (audit 2026-09-30). It is noted in `amb`
    so the reply can say why, and treated as unknown."""
    up = ident.strip().upper()
    if len(up) < 6:
        return None
    hits = [op for op, v in V.items() if v["chex"].upper().startswith(up)]
    if len(hits) == 1:
        return hits[0]
    if hits and amb is not None:
        amb.append(up)
    return None


def resolve_many(arg, V, amb=None):
    """`m_<flags>_<chex6>-<chex6>-...` from the stake and redelegate cards: one
    subscription per validator named, all with the same letters. Telegram's 64-char
    cap is why the page sends 6-character prefixes and at most eight per link."""
    if not arg.startswith("m_"):
        return []
    flags, _, ids = arg[2:].partition("_")
    flags = "".join(f for f in flags if f in ALERTS) or "d"
    out, seen = [], set()
    for ident in ids.split("-"):
        op = by_chex(ident, V, amb)
        if op and op not in seen:
            out.append((op, flags)); seen.add(op)
    return out


def resolve(arg, V, amb=None):
    """`v_<chex40>_<flags>` from the chooser (the full consensus address since 2026-10-01),
    the older `v_<chex8>_<flags>`, or the oldest `v_<operator>`."""
    if not arg.startswith("v_"):
        return None, ""
    body = arg[2:]
    ident, _, flags = body.partition("_")
    flags = "".join(f for f in flags if f in ALERTS) or "d"
    if ident in V:                                   # full operator address
        return ident, flags
    op = by_chex(ident, V, amb)                      # consensus address, whole or a unique prefix
    return (op, flags) if op else (None, "")


# ── commands ────────────────────────────────────────────────────────────────
# the two helper lines every confirmation and the help end with
HELPERS = ("/list shows your wallet and every validator you watch.\n"
           "/stop &lt;name&gt; stops one validator, /stop &lt;address&gt; stops a wallet, /stop alone stops everything.")

HELP = ("Alerts for AtomOne validators: when one stops signing, misses half its slashing "
        "window, is jailed, changes rank or its APR moves.\n\n"
        "Open the AtomOne app and tap the alert button in a validator's signing "
        "row, or the bell on the stake and redelegate cards, then choose what to hear "
        "about.\n\n"
        "Your own wallet: the Alerts button under Hands-free in the app's wallet column tells you "
        "each time Autopilot moves your stake or Restake stakes your rewards.\n\n"
        "A governor: Alerts on a governor's card in the app tells you each vote it casts, reminds you a day before "
        "a vote ends if it has not voted, and when it goes inactive or comes back.\n\n"
        + HELPERS + "\n\n" + PAGE)


def md(name):
    """A moniker is chain data, and it reaches a formatted message. Messages are
    sent as HTML, where escaping is exact; the legacy Markdown they used to go out
    as allows no escape inside bold, so a moniker like "[NODERS]" or "a_b" broke
    the message (Telegram answers 400 and the alert is lost), and a [text](url)
    shape could render a link - the one way chain data could name a destination."""
    return html.escape(str(name), quote=False)


GONE = set()          # chats Telegram says we can no longer reach, dropped after the pass


def send(chat, text):
    """One message. A 429 waits as long as Telegram asks and tries again; a 403 (the
    reader blocked the bot or deleted the chat) marks the chat for removal, so its
    subscriptions do not live on forever."""
    body = urllib.parse.urlencode(dict(chat_id=chat, text=text, parse_mode="HTML",
                                       disable_web_page_preview="true")).encode()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(API + "sendMessage", data=body), timeout=40) as r:
                return bool(json.loads(r.read()).get("ok"))
        except urllib.error.HTTPError as e:
            try: d = json.loads(e.read())
            except Exception: d = {}
            if e.code == 429:
                time.sleep(min(60, int((d.get("parameters") or {}).get("retry_after", 5)))); continue
            if e.code == 403:
                GONE.add(chat); log("chat %s is gone (%s)" % (chat, d.get("description", "403")))
                return False
            log("sendMessage %d: %s" % (e.code, d.get("description", "")[:200])); return False
        except Exception as e:
            log("sendMessage: %s" % e); time.sleep(2)
    return False


def drop_gone(c):
    while GONE:
        chat = GONE.pop()
        c.execute("DELETE FROM sub WHERE chat=?", (chat,)); c.execute("DELETE FROM wsub WHERE chat=?", (chat,)); c.execute("DELETE FROM gsub WHERE chat=?", (chat,)); c.commit()
        log("removed the subscriptions of chat %s" % chat)


def name(c, op, V):
    """a validator's moniker: from the page's data, else the last one we stored (a
    jailed validator is no longer in the data), else its address"""
    if op in V: return V[op]["m"]
    r = c.execute("SELECT m FROM vstate WHERE op=?", (op,)).fetchone()
    return r[0] if r and r[0] else op


def standing(c, subs, V):
    """what already holds for the validators just subscribed to, for the alerts chosen: an
    alert fires on a change, so without this a new subscriber to a validator that is down or
    past half its window would hear nothing until it recovers"""
    out = []
    for op, flags in subs:
        r = c.execute("SELECT down, half FROM vstate WHERE op=?", (op,)).fetchone()
        if not r: continue
        if "d" in flags and r[0]: out.append("<b>%s</b> is not signing right now." % md(V[op]["m"]))
        if "h" in flags and r[1]: out.append("<b>%s</b> has already missed half its slashing window." % md(V[op]["m"]))
    return ("\n\nRight now:\n" + "\n".join(out)) if out else ""


def handle(c, msg, V):
    chat = msg["chat"]["id"]
    text = (msg.get("text") or "").strip()
    if not text.startswith("/"):
        return send(chat, HELP)
    cmd, _, arg = text.partition(" ")
    cmd = cmd.split("@")[0].lower(); arg = arg.strip()

    if cmd == "/start" and arg.startswith("w_"):
        addr, fl = wallet(arg)
        if not addr:
            return send(chat, "That link does not carry a valid AtomOne address, so nothing was changed. Open the app and use Alerts under Hands-free in your wallet column.")
        had = c.execute("SELECT flags FROM wsub WHERE chat=? AND addr=?", (chat, addr)).fetchone()
        # subscribing again REPLACES the choice, as for validators
        c.execute("INSERT INTO wsub(chat, addr, made, flags) VALUES(?,?,?,?) ON CONFLICT(chat, addr) DO UPDATE SET flags=excluded.flags",
                  (chat, addr, int(time.time()), fl))
        # from now on: what already happened is not told again
        if not c.execute("SELECT 1 FROM wstate WHERE addr=?", (addr,)).fetchone():
            mv, rs = wallet_marks(report(addr))
            c.execute("INSERT INTO wstate(addr, mv_at, rs_total) VALUES(?,?,?)", (addr, mv, rs))
        c.commit()
        head = ("Already watching your wallet <code>%s</code>, with the same alerts:" if had and (had[0] or "ar") == fl else
                "Updated your wallet <code>%s</code>. Its alerts are now:" if had else "Watching your wallet <code>%s</code>. Its alerts are:")
        return send(chat, head + "\n\n%s\n\n"
                          "/list shows your wallet and every validator you watch.\n/stop %s stops this wallet, /stop stops everything." % (
                          short(addr), "\n".join("- %s: %s" % WALERTS[f] for f in fl), addr))

    if cmd == "/start" and arg.startswith("g_"):
        gov, fl = governor(arg)
        if not gov:
            return send(chat, "That link does not carry a valid governor address, so nothing was changed. Open the app and use Alerts on the governor's card.")
        gs, ps = gov_snapshot()
        if gs is not None and gov not in gs:
            return send(chat, "That governor is not registered on AtomOne, so nothing was changed.")
        had = c.execute("SELECT flags FROM gsub WHERE chat=? AND gov=?", (chat, gov)).fetchone()
        c.execute("INSERT INTO gsub(chat, gov, made, flags) VALUES(?,?,?,?) ON CONFLICT(chat, gov) DO UPDATE SET flags=excluded.flags",
                  (chat, gov, int(time.time()), fl))
        m = gs[gov][0] if gs else gov[:14]
        # its votes already cast are stated here, not announced again - but only when nobody watched it before: an
        # existing state belongs to the other watchers, whose next vote alert must not be silenced (audit 2026-10-13)
        st = gov_state(c, gov)
        now_votes = []
        if gs is not None:
            fresh = not st
            if fresh:
                st = {"m": m, "active": int(gs[gov][1]), "told": {}, "reminded": []}
            for pid, title, end in ps:
                v = gov_vote(gov_acct(gov), pid)
                if v:
                    if fresh: st["told"][str(pid)] = v
                    now_votes.append("#%d: %s" % (pid, v))
                elif v == "": now_votes.append("#%d: not voted yet, ends in %s" % (pid, gov_until(end)))
            if fresh: gov_save(c, gov, st)
        c.commit()
        head = ("Already watching governor <b>%s</b>, with the same alerts:" if had and (had[0] or "vms") == fl else
                "Updated governor <b>%s</b>. Its alerts are now:" if had else "Watching governor <b>%s</b>. Its alerts are:") % md(m)
        standing_g = ("\n\nOpen proposals now:\n" + "\n".join("- " + x for x in now_votes)) if now_votes else ""
        return send(chat, head + "\n\n%s%s\n\n/list shows everything you watch.\n/stop %s stops this governor, /stop stops everything." % (
                          "\n".join("- %s: %s" % GALERTS[f] for f in fl), standing_g, md(m)))

    if cmd == "/start":
        amb = []                                     # prefixes that named more than one validator
        many = resolve_bits(arg, V) or resolve_many(arg, V, amb)
        if not many:
            op, flags = resolve(arg, V, amb)
            many = [(op, flags)] if op else []
        if many:
            # one row per chat and validator: subscribing again REPLACES that validator's
            # choices (it is how a reader changes them), and the reply says so
            fl, updated = many[0][1], []
            # what the chat watched BEFORE this link: the reader knows that number, the page
            # cannot (it never sees who is subscribed), so the reply states it
            before = c.execute("SELECT count(*) FROM sub WHERE chat=?", (chat,)).fetchone()[0]
            for op, flags in many:
                old = c.execute("SELECT flags FROM sub WHERE chat=? AND op=?", (chat, op)).fetchone()
                if old: updated.append((op, old[0] or "d"))
                c.execute("INSERT INTO sub(chat, op, made, flags) VALUES(?,?,?,?) "
                          "ON CONFLICT(chat, op) DO UPDATE SET flags=excluded.flags",
                          (chat, op, int(time.time()), flags))
            c.commit()
            what = "\n".join("- " + ALERTS[f][0] for f in fl if f in ALERTS)
            if len(many) == 1:
                op = many[0][0]
                head = ("Updated <b>%s</b>. Its alerts are now:" if updated else "Watching <b>%s</b>.") % md(V[op]["m"])
                if updated and updated[0][1] == fl:
                    head = "Already watching <b>%s</b>, with the same alerts:" % md(V[op]["m"])
            else:
                head = "Watching %d validators:\n%s" % (len(many), "\n".join("- <b>%s</b>" % md(V[op]["m"]) for op, _ in many))
                if updated:
                    head += "\n\n%d of them you already watched: their alerts are replaced by these." % len(updated)
            # each validator is its own row, so adding one leaves the others as they were
            count = ("Before this, you did not watch any validators." if before == 0 else
                     "You already watch 1 validator." if before == 1 else
                     "You already watch %d validators." % before)
            skipped = ("\n\n%d validator%s in the link could not be told apart from another one and %s skipped: "
                       "open the app and use that validator's own alert button." % (len(amb), "" if len(amb) == 1 else "s",
                                                                                       "was" if len(amb) == 1 else "were")) if amb else ""
            return send(chat, "%s\n\n%s%s%s\n\n%s\n%s" % (head, what, standing(c, many, V), skipped, count, HELPERS))
        if arg and amb:
            return send(chat, "That link does not name one validator for certain (its short code fits more than one), "
                              "so nothing was changed. Open the app and use the validator's own alert button.")
        if arg:
            return send(chat, "That link names no validator in the active set, so nothing was changed. Open the app and use the validator's own alert button.")
        return send(chat, HELP)

    if cmd == "/list":
        rows = c.execute("SELECT op, flags FROM sub WHERE chat=?", (chat,)).fetchall()
        ws = c.execute("SELECT addr, flags FROM wsub WHERE chat=?", (chat,)).fetchall()
        gw = c.execute("SELECT s.gov, s.flags, g.m FROM gsub s LEFT JOIN gstate g ON g.gov = s.gov WHERE s.chat=?", (chat,)).fetchall()
        gl = "".join("Governor <b>%s</b>: %s\n" % (md(m or gv[:14]), ", ".join(GSHORT[f] for f in (fl or "vms") if f in GSHORT)) for gv, fl, m in gw)
        if not rows and not ws and not gw:
            return send(chat, "You are not watching a wallet or a validator yet.\n\n" + PAGE)
        return send(chat, gl + ("\n" if gl and (ws or rows) else "") + "".join("Your wallet <code>%s</code>: %s\n" % (short(a), " and ".join(WALERTS[f][0] for f in (fl or "ar") if f in WALERTS)) for a, fl in ws) +
                          ("\n" if ws and rows else "") + ("Watching:\n" if rows else "") + "\n".join(
            "- <b>%s</b> - %s" % (md(name(c, op, V)),
                             ", ".join(ALERTS[f][1] for f in (fl or "d") if f in ALERTS))
            for op, fl in rows))

    if cmd == "/stop":
        if arg.startswith("atone1"):
            n = c.execute("DELETE FROM wsub WHERE chat=? AND addr=?", (chat, arg)).rowcount; c.commit()
            return send(chat, ("Stopped watching <code>%s</code>." % short(arg)) if n else "You are not watching that wallet. /list shows what you watch.")
        if arg:
            # match among what this chat watches, by today's moniker or the stored one,
            # so a validator that has left the set can still be dropped by name
            gh = [gv for gv, m in c.execute("SELECT s.gov, g.m FROM gsub s LEFT JOIN gstate g ON g.gov = s.gov WHERE s.chat=?", (chat,)).fetchall()
                  if gv == arg or (m or "").lower() == arg.lower()]
            if gh:
                c.execute("DELETE FROM gsub WHERE chat=? AND gov=?", (chat, gh[0])); c.commit()
                return send(chat, "Stopped watching governor <b>%s</b>." % md(arg))
            mine = [r[0] for r in c.execute("SELECT op FROM sub WHERE chat=?", (chat,)).fetchall()]
            hit = [op for op in mine if name(c, op, V).lower() == arg.lower() or op == arg]
            if not hit:
                return send(chat, "You are not watching a validator by that name. /list shows who you watch.")
            c.execute("DELETE FROM sub WHERE chat=? AND op=?", (chat, hit[0])); c.commit()
            return send(chat, "Stopped watching <b>%s</b>." % md(name(c, hit[0], V)))
        c.execute("DELETE FROM sub WHERE chat=?", (chat,)); c.execute("DELETE FROM wsub WHERE chat=?", (chat,))
        c.execute("DELETE FROM gsub WHERE chat=?", (chat,)); c.commit()
        return send(chat, "Stopped watching everything.")

    return send(chat, HELP)


# ── a wallet's own alerts ───────────────────────────────────────────────────
def atone(u): return "{:,.1f}".format(int(u) / 1e6)


def wallets(c, V):
    """Each watched wallet: Autopilot moves newer than the last announced, one message per transaction; Restake when
    its total rose. The report is the keeper's own record of what landed on chain."""
    for (addr,) in c.execute("SELECT DISTINCT addr FROM wsub").fetchall():
        r = report(addr)
        if not r: continue
        st = c.execute("SELECT mv_at, rs_total FROM wstate WHERE addr=?", (addr,)).fetchone() or (None, None)
        if st[0] is None:                                # a wallet first seen: nothing old is told
            mv, rs = wallet_marks(r)
            c.execute("INSERT OR REPLACE INTO wstate(addr, mv_at, rs_total) VALUES(?,?,?)", (addr, mv, rs)); c.commit(); continue
        msgs, mv_at, rs_total = [], st[0] or 0, st[1] or 0
        new = [h for h in (r.get("history") or []) if int(h.get("at") or 0) > mv_at and h.get("txhash")]
        for tx in sorted({h["txhash"] for h in new}, key=lambda t: min(int(h["at"]) for h in new if h["txhash"] == t)):
            hs = [h for h in new if h["txhash"] == tx]
            amt = sum(int(h.get("uatone") or 0) for h in hs); gain = sum(float(h.get("gain") or 0) for h in hs)
            src = sorted({h["src"] for h in hs}, key=lambda o: name(c, o, V)); dst = {h["dst"] for h in hs}
            msgs.append(("a", "<b>Autopilot moved %s ATONE</b>\nfrom %s to %d smaller validator%s\n%s ATONE a year\n%s<a href=\"%s%s\">%s</a>" % (
                atone(amt), ", ".join("<b>%s</b>" % md(name(c, o, V)) for o in src[:3]) + (" and %d more" % (len(src) - 3) if len(src) > 3 else ""),
                len(dst), "" if len(dst) == 1 else "s", "{:+,.1f}".format(gain),
                "Wallet <code>%s</code>, " % short(addr), EXPLORER, tx, tx[:8])))
            mv_at = max(mv_at, max(int(h["at"]) for h in hs))
        rs = r.get("restake") or {}
        tot = int(rs.get("total") or 0)
        if tot > rs_total:
            legs = rs.get("stake") or []
            h = ((rs.get("result") or {}).get("txhash")) or ""
            msgs.append(("r", "<b>Restake staked %s ATONE of rewards</b>\n%sWallet <code>%s</code>%s" % (
                atone(tot - rs_total), ("across %d validators\n" % len(legs)) if len(legs) > 1 else "",
                short(addr), (', <a href="%s%s">%s</a>' % (EXPLORER, h, h[:8])) if h else "")))
            rs_total = tot
        if not msgs: continue
        for chat, fl in c.execute("SELECT chat, flags FROM wsub WHERE addr=?", (addr,)).fetchall():
            for k, t in msgs:
                if k in (fl or "ar"): send(chat, t)
        c.execute("UPDATE wstate SET mv_at=?, rs_total=? WHERE addr=?", (mv_at, rs_total, addr)); c.commit()


# ── the watch ───────────────────────────────────────────────────────────────
STALE = [False]


def check(c, V):
    """One pass over everything anyone is watching.

    Each event is emitted only to the chats that asked for that letter, and only
    when the value actually changes - the stored state is what makes this one
    message per transition rather than one per minute.
    """
    height, age = tip()
    if height is None:
        return
    stale = age is not None and age > STALE_S
    if stale != STALE[0]:
        STALE[0] = stale
        log("index %s: newest block %s is %ss old" % ("STALE" if stale else "fresh again", height, age))
    known = height - 1                                   # the newest height whose signatures are in
    SL = slashing()
    subs = {}
    for op, chat, fl in c.execute("SELECT op, chat, flags FROM sub").fetchall():
        subs.setdefault(op, []).append((chat, fl or "d"))

    for op, watchers in subs.items():
        v = V.get(op)
        row = c.execute("SELECT down, rank, apr, jail, m, rank_ref, jail_h, half, out FROM vstate WHERE op=?", (op,)).fetchone()
        was_down, was_rank, was_apr, was_jail, was_m, rank_ref, jail_h, half, out = row if row else (0, None, None, None, None, None, None, None, 0)
        m = v["m"] if v else (was_m or op)
        chex = v["chex"] if v else None
        events = []                                      # (letter, message)

        # jailed: from the index, whether or not the page still lists the validator
        if chex is None:
            r = c.execute("SELECT chex FROM vchex WHERE op=?", (op,)).fetchone()
            chex = r[0] if r else None
        jh = last_jail(op, chex)
        if jh is not None:
            if jail_h is not None and jh > jail_h:
                events.append(("j", "<b>%s</b> was jailed at height %s.\nIt is out of the active set until it unjails."
                               % (md(m), format(jh, ","))))
                out = 1
            jail_h = jh
        # back: the page lists it again and it is not jailed
        if out and v and not v.get("jail"):
            events.append(("j", "<b>%s</b> is back in the active set." % md(m)))
            out = 0

        # signing - only while it is in the set, and only on a fresh index
        down = bool(was_down)
        if v and not stale:
            n = missed_recent(v["chex"], known)
            if n is not None:
                if n >= WINDOW:  down = True
                elif n == 0:     down = False
                if down != bool(was_down):
                    events.append(("d", ("<b>%s</b> stopped signing.\nMissed the last %d blocks, height %s."
                                         % (md(m), WINDOW, format(known, ",")))
                                   if down else
                                   ("<b>%s</b> is signing again.\nHeight %s." % (md(m), format(known, ",")))))

        # half the slashing window: the chain's own counter, as the Discord watch reads it. In at
        # the critical line, out below 80% of it (the same hysteresis), once each way. A validator
        # already past the line when first watched is reported once.
        if v and SL and re.fullmatch(r"[0-9A-Fa-f]{40}", v["chex"] or ""):
            miss, W, crit = SL
            n = miss.get(valcons(v["chex"]))
            if n is not None:
                if n >= crit and not half:
                    events.append(("h", "<b>%s</b> has missed %s of the last %s blocks, over half its slashing window.\nIt is jailed at %s missed."
                                   % (md(m), format(n, ","), format(W, ","), format(jail_at(W), ","))))
                    half = 1
                elif n < crit * 0.8 and half:
                    events.append(("h", "<b>%s</b> is out of the critical zone.\nMissed %s of %s." % (md(m), format(n, ","), format(W, ","))))
                    half = 0
                elif half is None:
                    half = 0

        # rank, against the rank at the last rank alert
        rank = v.get("rank") if v else was_rank
        if v and rank:
            if rank_ref is None:
                rank_ref = rank
            elif abs(rank - rank_ref) >= RANK_STEP:
                events.append(("r", "<b>%s</b> moved %s %d places.\nRank %d, was %d."
                               % (md(m), "up" if rank < rank_ref else "down", abs(rank - rank_ref), rank, rank_ref)))
                rank_ref = rank

        # APR, against the value at the last APR alert
        apr = v.get("apr") if v else None
        apr_ref = was_apr
        if apr:
            if not apr_ref:
                apr_ref = apr                             # first sight: the reference
            else:
                move = apr / apr_ref - 1
                if abs(move) >= APR_STEP["t"]:
                    events.append(("t", "<b>%s</b> APR %s from %.1f%% to %.1f%%."
                                   % (md(m), "rose" if move > 0 else "fell", apr_ref * 100, apr * 100)))
                    apr_ref = apr

        if v:
            c.execute("INSERT INTO vchex(op, chex) VALUES(?,?) ON CONFLICT(op) DO UPDATE SET chex=excluded.chex", (op, v["chex"]))
        c.execute("""INSERT INTO vstate(op, down, since, rank, apr, jail, m, rank_ref, jail_h, half, out)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?)
                     ON CONFLICT(op) DO UPDATE SET down=excluded.down, since=excluded.since,
                       rank=excluded.rank, apr=excluded.apr, jail=excluded.jail, m=excluded.m,
                       rank_ref=excluded.rank_ref, jail_h=excluded.jail_h, half=excluded.half, out=excluded.out""",
                  (op, int(down), known, rank, apr_ref, v.get("jail", 0) if v else was_jail, m, rank_ref, jail_h, half, out or 0))
        c.commit()

        for letter, msg in events:
            for chat, fl in watchers:
                if letter in fl:
                    send(chat, msg)
                    time.sleep(0.05)                     # well under Telegram's limit
            log("%s: %s" % (m, ALERTS[letter][1]))
    drop_gone(c)


def heartbeat(username):
    """bot.json: the page offers alerts only while this is fresh (collect.py checks
    'alive'), and takes the window and rank step from here so its wording matches"""
    tmp = IDFILE + ".tmp"
    SL = slashing()
    json.dump({"username": username, "alive": int(time.time()), "window": WINDOW,
               "rank_step": RANK_STEP, "slash_window": SL[1] if SL else None,
               "slash_crit": SL[2] if SL else None}, open(tmp, "w"))
    os.replace(tmp, IDFILE)


def backup(c):
    """a consistent copy of the subscriptions next to the app's state, which restic keeps"""
    try:
        b = sqlite3.connect(BACKUP + ".tmp"); c.backup(b); b.close()
        os.replace(BACKUP + ".tmp", BACKUP)
    except Exception as e:
        log("backup: %s" % e)


def main():
    c = store()
    me = tg("getMe")
    if not me:
        log("getMe failed - bad token?"); sys.exit(1)
    log("running as @%s" % me["username"])
    # the page reads this to build its deep link, so the link can never point at
    # a bot that does not exist or carry a username typed from memory
    heartbeat(me["username"])

    offset = int(meta_get(c, "offset", 0))
    last = last_backup = last_gov = 0
    fails = 0
    while True:
        V = vals()
        ups = tg("getUpdates", offset=offset, timeout=25, allowed_updates='["message"]')
        if ups is None:
            # a fast failure (DNS, refused, 401 after a token change, 409 from a
            # second poller) must not spin: back off, up to a minute
            fails += 1
            time.sleep(min(60, 2 ** min(fails, 6)))
        else:
            fails = 0
        for u in ups or []:
            offset = u["update_id"] + 1
            meta_set(c, "offset", offset)
            if "message" in u:
                try:
                    handle(c, u["message"], V)
                except Exception as e:
                    log("handle: %s" % e)
        drop_gone(c)
        if time.time() - last >= CHECK:
            last = time.time()
            try:
                check(c, V)
            except Exception as e:
                log("check: %s" % e)
            try:
                wallets(c, V)
            except Exception as e:
                log("wallets: %s" % e)
            heartbeat(me["username"])
        if time.time() - last_gov >= GCHECK:
            last_gov = time.time()
            try:
                govcheck(c)
            except Exception as e:
                log("governors: %s" % e)
        if time.time() - last_backup >= 3600:
            last_backup = time.time(); backup(c)


if __name__ == "__main__":
    main()
