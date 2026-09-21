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
import json, os, re, sqlite3, subprocess, sys, time, urllib.parse, urllib.request

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
                           ("vstate", "jail", "INTEGER")):
        try:
            c.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} {decl}")
        except sqlite3.OperationalError:
            pass
    c.execute("CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT)")
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


def missed_recent(chex, tip):
    # chex reaches SQL by interpolation; it is a consensus address from our own
    # data.json, but assert the shape rather than trust the provenance
    if not re.fullmatch(r"[0-9A-Fa-f]{40}", chex or ""):
        return None
    r = sql("""SELECT count(*) FROM missed_signature
               WHERE chain_id='%s' AND cons_addr='%s' AND height > %d""",
            (CHAIN, chex, tip - WINDOW))
    return int(r[0][0]) if r else None


def tip_height():
    r = sql("SELECT max(height) FROM block WHERE chain_id='%s'", (CHAIN,))
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
    "d": ("Stops signing - misses 10 blocks in a row", "signing"),
    "j": ("Jailed - drops out of the active set",      "jailed"),
    "r": ("Rank changes",                              "rank"),
    "t": ("APR moves ±10% or more",                    "APR ±10%"),
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
HELP = ("Downtime alerts for AtomOne validators.\n\n"
        "Open the AtomOne app, tap a validator, then tap *Alert me* - that "
        "subscribes you to that validator.\n\n"
        "/list - who you are watching\n"
        "/stop - unsubscribe from all\n"
        "/stop <moniker> - unsubscribe from one\n\n" + PAGE)


def md(name):
    """A moniker is chain data. Under legacy Markdown an unbalanced _ * ` or a
    [text](url) shape would either break the message (Telegram answers 400 and
    the alert is lost) or render a link - the one way chain data could name a
    destination. Escape the four characters that carry meaning."""
    return re.sub(r"([_*`\[])", r"\\\1", str(name))


def send(chat, text):
    tg("sendMessage", chat_id=chat, text=text, parse_mode="Markdown",
       disable_web_page_preview="true")


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
                        % (len(many), "\n".join("- *%s*" % md(V[op]["m"]) for op, _ in many),
                           "\n".join("- " + ALERTS[f][0] for f in fl if f in ALERTS)))
        op, flags = resolve(arg, V)
        if op:
            c.execute("INSERT INTO sub(chat, op, made, flags) VALUES(?,?,?,?) "
                      "ON CONFLICT(chat, op) DO UPDATE SET flags=excluded.flags",
                      (chat, op, int(time.time()), flags))
            c.commit()
            return send(chat, "Watching *%s*.\n\n%s\n\n/stop to undo."
                        % (V[op]["m"], "\n".join("- " + ALERTS[f][0] for f in flags if f in ALERTS)))
        if arg:
            return send(chat, "That validator is not in the active set.")
        return send(chat, HELP)

    if cmd == "/list":
        rows = c.execute("SELECT op, flags FROM sub WHERE chat=?", (chat,)).fetchall()
        if not rows:
            return send(chat, "You are not watching anyone yet.\n\n" + PAGE)
        return send(chat, "Watching:\n" + "\n".join(
            "- *%s* — %s" % (V.get(op, {}).get("m", op),
                             ", ".join(ALERTS[f][1] for f in (fl or "d") if f in ALERTS))
            for op, fl in rows))

    if cmd == "/stop":
        if arg:
            hit = [op for op, v in V.items() if v["m"].lower() == arg.lower()]
            if not hit:
                return send(chat, "No validator by that name.")
            c.execute("DELETE FROM sub WHERE chat=? AND op=?", (chat, hit[0])); c.commit()
            return send(chat, "Stopped watching *%s*." % V[hit[0]]["m"])
        c.execute("DELETE FROM sub WHERE chat=?", (chat,)); c.commit()
        return send(chat, "Unsubscribed from everything.")

    return send(chat, HELP)


# ── the watch ───────────────────────────────────────────────────────────────
def check(c, V):
    """One pass over everything anyone is watching.

    Each event is emitted only to the chats that asked for that letter, and only
    when the value actually changes - the stored state is what makes this one
    message per transition rather than one per minute.
    """
    tip = tip_height()
    if tip is None:
        return
    subs = {}
    for op, chat, fl in c.execute("SELECT op, chat, flags FROM sub").fetchall():
        subs.setdefault(op, []).append((chat, fl or "d"))

    for op, watchers in subs.items():
        v = V.get(op)
        if not v:
            continue                                     # left the set: stay quiet
        row = c.execute("SELECT down, rank, apr, jail FROM vstate WHERE op=?", (op,)).fetchone()
        was_down, was_rank, was_apr, was_jail = (row if row else (0, None, None, None))
        events = []                                      # (letter, message)

        # signing
        n = missed_recent(v["chex"], tip)
        down = bool(was_down)
        if n is not None:
            if n >= WINDOW:  down = True
            elif n == 0:     down = False
            if down != bool(was_down):
                events.append(("d", ("*%s* stopped signing.\nMissed the last %d blocks, height %s."
                                     % (md(v["m"]), WINDOW, format(tip, ",")))
                               if down else
                               ("*%s* is signing again.\nHeight %s." % (md(v["m"]), format(tip, ",")))))

        # jailed - the count only ever rises
        jail = v.get("jail", 0)
        if was_jail is not None and jail > was_jail:
            events.append(("j", "*%s* was jailed.\nIt is out of the active set until it unjails."
                           % v["m"]))

        # rank
        rank = v.get("rank")
        if was_rank and rank and rank != was_rank:
            events.append(("r", "*%s* moved %s.\nRank %d, was %d."
                           % (md(v["m"]), "up" if rank < was_rank else "down", rank, was_rank)))

        # APR, against the value at the last alert rather than the last check
        apr, apr_ref = v.get("apr"), was_apr
        if apr and apr_ref:
            move = apr / apr_ref - 1
            for letter in ("t",):
                if abs(move) >= APR_STEP[letter]:
                    events.append((letter, "*%s* APR %s %.1f%%.\nNow %.1f%%, was %.1f%%."
                                   % (md(v["m"]), "rose" if move > 0 else "fell",
                                      abs(move) * 100, apr * 100, apr_ref * 100)))
                    apr_ref = apr                        # reset the reference
                    break

        c.execute("""INSERT INTO vstate(op, down, since, rank, apr, jail)
                     VALUES(?,?,?,?,?,?)
                     ON CONFLICT(op) DO UPDATE SET down=excluded.down, since=excluded.since,
                       rank=excluded.rank, apr=excluded.apr, jail=excluded.jail""",
                  (op, int(down), tip, rank, apr_ref if apr else was_apr, jail))
        c.commit()

        for letter, msg in events:
            for chat, fl in watchers:
                if letter in fl:
                    send(chat, msg)
                    time.sleep(0.05)                     # well under Telegram's limit
            log("%s: %s" % (md(v["m"]), ALERTS[letter][1]))


def main():
    c = store()
    me = tg("getMe")
    if not me:
        log("getMe failed - bad token?"); sys.exit(1)
    log("running as @%s" % me["username"])
    # the page reads this to build its deep link, so the link can never point at
    # a bot that does not exist or carry a username typed from memory
    tmp = IDFILE + ".tmp"
    json.dump({"username": me["username"]}, open(tmp, "w"))
    os.replace(tmp, IDFILE)

    offset = int(meta_get(c, "offset", 0))
    last = 0
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
        if time.time() - last >= CHECK:
            last = time.time()
            try:
                check(c, V)
            except Exception as e:
                log("check: %s" % e)


if __name__ == "__main__":
    main()
