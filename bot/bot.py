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
import html, json, os, re, sqlite3, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

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
BACKUP = os.path.join(STATE, "subs.backup.db")
API    = "https://api.telegram.org/bot" + TOKEN + "/"

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
                           ("vstate", "jail_h", "INTEGER")):
        try:
            c.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} {decl}")
        except sqlite3.OperationalError:
            pass
    c.execute("CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT)")
    # the consensus address of each watched validator, kept for when it leaves the page's data
    c.execute("CREATE TABLE IF NOT EXISTS vchex(op TEXT PRIMARY KEY, chex TEXT)")
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
# validator travels as an 8-character consensus-address prefix and each alert is
# one letter rather than a word.
# INVARIANT: every alert states a FACT about a validator the reader already holds.
# It must never name a destination, rank an alternative, or suggest a move. The
# portal shows the same live numbers to everyone at once; a push notification that
# says "go here" would hand whoever reads it first an edge over everyone else - and
# under the 21-day transitive-redelegation lock the latecomers could not undo it.
# Alerts tell you what happened to what you own. Nothing more.
ALERTS = {
    "d": ("Stops signing - misses %d blocks in a row" % WINDOW, "signing"),
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


def resolve_many(arg, V):
    """`m_<flags>_<chex6>-<chex6>-...` from the stake and redelegate cards: one
    subscription per validator named, all with the same letters. Telegram's 64-char
    cap is why the page sends 6-character prefixes and at most eight per link."""
    if not arg.startswith("m_"):
        return []
    flags, _, ids = arg[2:].partition("_")
    flags = "".join(f for f in flags if f in ALERTS) or "d"
    out, seen = [], set()
    for ident in ids.split("-"):
        up = ident.strip().upper()
        if len(up) < 6:
            continue
        for op, v in V.items():
            if v["chex"].upper().startswith(up) and op not in seen:
                out.append((op, flags)); seen.add(op); break
    return out


def resolve(arg, V):
    """`v_<chex8>_<flags>` from the chooser, or the older `v_<operator>`."""
    if not arg.startswith("v_"):
        return None, ""
    body = arg[2:]
    ident, _, flags = body.partition("_")
    flags = "".join(f for f in flags if f in ALERTS) or "d"
    if ident in V:                                   # full operator address
        return ident, flags
    up = ident.upper()
    for op, v in V.items():                          # consensus-address prefix
        if v["chex"].upper().startswith(up) and len(up) >= 6:
            return op, flags
    return None, ""


# ── commands ────────────────────────────────────────────────────────────────
HELP = ("Alerts for AtomOne validators: when one stops signing, is jailed, "
        "changes rank or its APR moves.\n\n"
        "Open the AtomOne app and tap the Telegram button in a validator's signing "
        "row, or the bell on the stake and redelegate cards, then choose what to hear "
        "about.\n\n"
        "/list - who you are watching\n"
        "/stop - unsubscribe from all\n"
        "/stop &lt;moniker&gt; - unsubscribe from one\n\n" + PAGE)


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
        c.execute("DELETE FROM sub WHERE chat=?", (chat,)); c.commit()
        log("removed the subscriptions of chat %s" % chat)


def name(c, op, V):
    """a validator's moniker: from the page's data, else the last one we stored (a
    jailed validator is no longer in the data), else its address"""
    if op in V: return V[op]["m"]
    r = c.execute("SELECT m FROM vstate WHERE op=?", (op,)).fetchone()
    return r[0] if r and r[0] else op


def handle(c, msg, V):
    chat = msg["chat"]["id"]
    text = (msg.get("text") or "").strip()
    if not text.startswith("/"):
        return send(chat, HELP)
    cmd, _, arg = text.partition(" ")
    cmd = cmd.split("@")[0].lower(); arg = arg.strip()

    if cmd == "/start":
        many = resolve_bits(arg, V) or resolve_many(arg, V)
        if many:
            for op, flags in many:
                c.execute("INSERT INTO sub(chat, op, made, flags) VALUES(?,?,?,?) "
                          "ON CONFLICT(chat, op) DO UPDATE SET flags=excluded.flags",
                          (chat, op, int(time.time()), flags))
            c.commit()
            fl = many[0][1]
            return send(chat, "Watching %d validators:\n%s\n\n%s\n\n/stop to undo."
                        % (len(many), "\n".join("- <b>%s</b>" % md(V[op]["m"]) for op, _ in many),
                           "\n".join("- " + ALERTS[f][0] for f in fl if f in ALERTS)))
        op, flags = resolve(arg, V)
        if op:
            c.execute("INSERT INTO sub(chat, op, made, flags) VALUES(?,?,?,?) "
                      "ON CONFLICT(chat, op) DO UPDATE SET flags=excluded.flags",
                      (chat, op, int(time.time()), flags))
            c.commit()
            return send(chat, "Watching <b>%s</b>.\n\n%s\n\n/stop to undo."
                        % (md(V[op]["m"]), "\n".join("- " + ALERTS[f][0] for f in flags if f in ALERTS)))
        if arg:
            return send(chat, "That validator is not in the active set.")
        return send(chat, HELP)

    if cmd == "/list":
        rows = c.execute("SELECT op, flags FROM sub WHERE chat=?", (chat,)).fetchall()
        if not rows:
            return send(chat, "You are not watching anyone yet.\n\n" + PAGE)
        return send(chat, "Watching:\n" + "\n".join(
            "- <b>%s</b> — %s" % (md(name(c, op, V)),
                             ", ".join(ALERTS[f][1] for f in (fl or "d") if f in ALERTS))
            for op, fl in rows))

    if cmd == "/stop":
        if arg:
            # match among what this chat watches, by today's moniker or the stored one,
            # so a validator that has left the set can still be dropped by name
            mine = [r[0] for r in c.execute("SELECT op FROM sub WHERE chat=?", (chat,)).fetchall()]
            hit = [op for op in mine if name(c, op, V).lower() == arg.lower() or op == arg]
            if not hit:
                return send(chat, "You are not watching a validator by that name. /list shows who you watch.")
            c.execute("DELETE FROM sub WHERE chat=? AND op=?", (chat, hit[0])); c.commit()
            return send(chat, "Stopped watching <b>%s</b>." % md(name(c, hit[0], V)))
        c.execute("DELETE FROM sub WHERE chat=?", (chat,)); c.commit()
        return send(chat, "Unsubscribed from everything.")

    return send(chat, HELP)


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
    subs = {}
    for op, chat, fl in c.execute("SELECT op, chat, flags FROM sub").fetchall():
        subs.setdefault(op, []).append((chat, fl or "d"))

    for op, watchers in subs.items():
        v = V.get(op)
        row = c.execute("SELECT down, rank, apr, jail, m, rank_ref, jail_h FROM vstate WHERE op=?", (op,)).fetchone()
        was_down, was_rank, was_apr, was_jail, was_m, rank_ref, jail_h = row if row else (0, None, None, None, None, None, None)
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
            jail_h = jh

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
                    events.append(("t", "<b>%s</b> APR %s %.1f%%.\nNow %.1f%%, was %.1f%%."
                                   % (md(m), "rose" if move > 0 else "fell",
                                      abs(move) * 100, apr * 100, apr_ref * 100)))
                    apr_ref = apr

        if v:
            c.execute("INSERT INTO vchex(op, chex) VALUES(?,?) ON CONFLICT(op) DO UPDATE SET chex=excluded.chex", (op, v["chex"]))
        c.execute("""INSERT INTO vstate(op, down, since, rank, apr, jail, m, rank_ref, jail_h)
                     VALUES(?,?,?,?,?,?,?,?,?)
                     ON CONFLICT(op) DO UPDATE SET down=excluded.down, since=excluded.since,
                       rank=excluded.rank, apr=excluded.apr, jail=excluded.jail, m=excluded.m,
                       rank_ref=excluded.rank_ref, jail_h=excluded.jail_h""",
                  (op, int(down), known, rank, apr_ref, v.get("jail", 0) if v else was_jail, m, rank_ref, jail_h))
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
    json.dump({"username": username, "alive": int(time.time()), "window": WINDOW,
               "rank_step": RANK_STEP}, open(tmp, "w"))
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
    last = last_backup = 0
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
            heartbeat(me["username"])
        if time.time() - last_backup >= 3600:
            last_backup = time.time(); backup(c)


if __name__ == "__main__":
    main()
