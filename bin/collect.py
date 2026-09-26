#!/usr/bin/env python3
"""
Collect every figure the AtomOne app shows, from live sources, into data.json.

WHY A COLLECTOR AND NOT A WEB APP. Same shape as the snapshot service: a timer
regenerates static output, nginx serves it. No long-running process holds the DB
credential, nothing reachable from the web tier can query anything, and a failed
run leaves the previous good output in place rather than serving a half-page.

FAILS LOUDLY. Any source unreachable or any figure implausible aborts with a
non-zero exit, so OnFailure= alerts and the last good data.json stays up.
"""
import json, os, re, ssl, subprocess, sys, time, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

RPC   = os.environ["ATOMONE_RPC"]
# our node is pruned; historical validator sets come from a public archive
ARCHIVE = os.environ.get("ATOMONE_ARCHIVE_RPC", "https://rpc.atomone-archive.citizenweb3.com")
API   = os.environ["ATOMONE_API"]
# NET=testnet: the same page for atomone-testnet-1 from its own node and API. Our index
# (gata_indexer) holds mainnet only, so every figure drawn from it is published empty and
# the page shows N/A; the chain's own figures (validators, stake, pool, params) are real.
TESTNET = os.environ.get("NET", "mainnet") == "testnet"
DSN   = os.environ.get("ATOMONE_APP_DSN", "") if TESTNET else os.environ["ATOMONE_APP_DSN"]
CHAIN = os.environ.get("CHAIN_ID", "atomone-testnet-1" if TESTNET else "atomone-1")
OUT   = os.environ.get("OUT_DIR", "/srv/atomone-app/web")
STATE = os.environ.get("STATE_DIR", "/srv/atomone-app/state/testnet" if TESTNET else "/srv/atomone-app/state")
os.makedirs(STATE, exist_ok=True)


# ── bech32, to map slash_event.cons_addr -> validator ────────────────────────
# slash_event.operator is NULL on every row, so the only join is via the consensus
# address: sha256(ed25519 pubkey)[:20], bech32 as atonevalcons. Derived here rather
# than stored, so it cannot drift from the live validator set.
_CH = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
def _pm(v):
    g = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]; c = 1
    for e in v:
        b = c >> 25; c = ((c & 0x1ffffff) << 5) ^ e
        for i in range(5):
            if (b >> i) & 1: c ^= g[i]
    return c
def _bech32(hrp, data):
    d = []; acc = bits = 0
    for b in data:
        acc = (acc << 8) | b; bits += 8
        while bits >= 5: bits -= 5; d.append((acc >> bits) & 31)
    if bits: d.append((acc << (5 - bits)) & 31)
    v = [ord(c) >> 5 for c in hrp] + [0] + [ord(c) & 31 for c in hrp] + d + [0] * 6
    pol = _pm(v) ^ 1
    return hrp + "1" + "".join(_CH[c] for c in d + [(pol >> 5 * (5 - i)) & 31 for i in range(6)])

def die(msg):
    print(f"atomone-app: FATAL {msg}", file=sys.stderr); sys.exit(1)

def get(url, timeout=25):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return json.loads(r.read())
    except Exception as e:
        die(f"fetch {url}: {e}")

# The DSN carries a password, and a process's argv is world-readable through
# /proc while it runs - `ps` would hand the database credential to any local
# account. libpq takes the password from the environment instead, and
# /proc/<pid>/environ is readable only by the owner and root.
_u = urllib.parse.urlparse(DSN)
PGENV = dict(os.environ)
if _u.password:
    PGENV["PGPASSWORD"] = urllib.parse.unquote(_u.password)
    DSN_SAFE = _u._replace(netloc="{}@{}{}".format(
        _u.username, _u.hostname, ":%d" % _u.port if _u.port else "")).geturl()
else:
    DSN_SAFE = DSN

def sql(q, timeout=180):
    if TESTNET:
        return []                # no index for testnet: every query reads as empty -> N/A
    p = subprocess.run(["psql", DSN_SAFE, "-tAF", "\x1f", "-c", q],
                       capture_output=True, text=True, timeout=timeout, env=PGENV)
    if p.returncode != 0:
        die(f"sql: {p.stderr.strip()[:200]}")
    return [l.split("\x1f") for l in p.stdout.strip().split("\n") if l]

# ── chain state ───────────────────────────────────────────────────────────────
status = get(f"{RPC}/status")["result"]
if status["node_info"]["network"] != CHAIN:
    die(f"node serves {status['node_info']['network']}, expected {CHAIN}")
if status["sync_info"]["catching_up"]:
    die("node is catching up - refusing to publish figures from a lagging node")
head = int(status["sync_info"]["latest_block_height"])

coef  = float(get(f"{API}/cosmos/distribution/v1beta1/nakamoto_bonus_coefficient")["coefficient"])
dparm = get(f"{API}/cosmos/distribution/v1beta1/params")["params"]
nb    = dparm["nakamoto_bonus"]
tax   = float(dparm["community_tax"])
prov  = float(get(f"{API}/cosmos/mint/v1beta1/annual_provisions")["annual_provisions"])
infl  = float(get(f"{API}/cosmos/mint/v1beta1/inflation")["inflation"])
pool  = get(f"{API}/cosmos/staking/v1beta1/pool")["pool"]
sparm = get(f"{API}/cosmos/staking/v1beta1/params")["params"]
# The floor, not a cap: every validator is free to charge more, and today every
# one of them sits exactly on it.
mincom = float(sparm.get("min_commission_rate", 0))
# Community pool, in uatone. The tax above is the rate flowing in; this is the
# balance that has accumulated and that governance can spend.
cpool = 0.0
for c in get(f"{API}/cosmos/distribution/v1beta1/community_pool").get("pool", []):
    if c.get("denom") == "uatone":
        cpool = float(c["amount"])
supply= int(get(f"{API}/cosmos/bank/v1beta1/supply/by_denom?denom=uatone")["amount"]["amount"])
vals_r= get(f"{API}/cosmos/staking/v1beta1/validators"
            "?status=BOND_STATUS_BONDED&pagination.limit=500")["validators"]
all_r = get(f"{API}/cosmos/staking/v1beta1/validators?pagination.limit=1000")["validators"]

import base64, hashlib
# The SAME 20 bytes are stored in TWO encodings in this database: slash_event.cons_addr
# is bech32 (atonevalcons1...), block.proposer_cons is uppercase hex. Joining on the
# wrong one silently yields zero matches rather than an error - which is exactly how
# every validator first showed "0 blocks proposed".
def _addr20(v):
    return hashlib.sha256(base64.b64decode(v["consensus_pubkey"]["key"])).digest()[:20]
def _cons(v):  return _bech32("atonevalcons", _addr20(v))   # slash_event
def _chex(v):  return _addr20(v).hex().upper()              # block.proposer_cons
# cons address -> moniker, over EVERY status, so jailed validators still resolve
CONS = {_cons(v): v["description"]["moniker"] for v in all_r}

V = sorted([{"m": v["description"]["moniker"],
             "t": int(v["tokens"]),
             "c": float(v["commission"]["commission_rates"]["rate"]),
             "op": v["operator_address"],
             "cons": _cons(v),
             "chex": _chex(v),
             "web": (v["description"].get("website") or "")[:120],
             "det": (v["description"].get("details") or "")[:220],
             # becomes a cache filename and a published URL path, so it is
             # dropped unless it is a plain handle or key suffix
             "id": (lambda i: i if re.fullmatch(r"[A-Za-z0-9_.-]{1,32}", i) else "")(
                       (v["description"].get("identity") or "")[:16]),
             "sh": int(float(v.get("delegator_shares", 0)))}
            for v in vals_r if not v.get("jailed")],
           key=lambda x: -x["t"])
N = len(V)
if N < 3: die(f"only {N} bonded validators - the bonus needs 3 groups")
S = sum(v["t"] for v in V)
R = prov * (1.0 - tax)                      # annual validator reward pool, uatone
MEAN, BASE = S / N, R / S

# ── the rule ────────────────────────────────────────────────────────────
# ADR-004 splits the set into three groups by voting power and compares the
# AVERAGE of the high group with the average of the low group. The remainder goes
# to the LOW group, so at N=100 it is 33 / 33 / 34, not 33 / 33 / 33. Taking 33
# on both ends quietly overstated the ratio (10.480 against 10.411 today).
g  = N // 3
gl = N - 2 * g
Hi = sum(v["t"] for v in V[:g]); Lo = sum(v["t"] for v in V[N-gl:])
ratio = (Hi/g) / (Lo/gl) if Lo else float("inf")
# At or above 3x the coefficient steps UP; below it the coefficient steps DOWN.
# It does not stop - the rule is symmetric, which is what makes it a rule that holds either way.
rising = ratio >= 3.0
# ATONE that must actually move for the ratio to reach the threshold.
#
# The obvious closed form - solve (Hi-m)/g = 3*(Lo+m)/gl for m - assumes the
# GROUPS DO NOT CHANGE. They do: shifting that much stake drops the smallest of
# the top third below the largest of the middle third, the set re-sorts, and the
# ratio lands at 5.4x rather than 3.0x. Worse, that mechanism is not even
# monotonic - push it further and re-sorting sends concentration back up, so no
# amount of proportional top-to-bottom transfer reaches 3x at all.
#
# So measure the transfer under a move that PRESERVES THE ORDER: pull every
# holding toward the mean by one factor, t -> mean + lam*(t - mean), which is the
# same model the page's concentration control uses. lam is solved from the
# threshold, and the figure reported is the stake that changes hands - the sum
# given up by everyone above the mean.
_A, _B = Hi/g - MEAN, Lo/gl - MEAN
_den = _A - 3.0*_B
_lam = (MEAN*(3.0 - 1.0)/_den) if _den else 1.0
# lam > 1 stretches the set AWAY from the mean, which is what a chain sitting
# BELOW the threshold would need: there the move runs the other way, from the
# smallest third to the largest, to bring concentration back up to 3x. Only the
# floor is clamped, so both directions are representable.
_tmin = V[-1]["t"]
if _tmin < MEAN:
    _lam = min(_lam, MEAN/(MEAN - _tmin)*0.999)
_lam = max(0.0, _lam)
# whoever gives stake up - the same sum in either direction
move = sum(max(0.0, v["t"] - (MEAN + _lam*(v["t"] - MEAN))) for v in V)
move_from, move_to = (("Largest", "smallest") if ratio > 3.0 else ("Smallest", "largest"))

# ── weekly epoch schedule, anchored on the chain's own epoch ──────────────────
# The anchor is the chain's own "week" epoch start. The REST endpoint serves it;
# it is read every run and compared with the constant, so a parameter change or
# a chain upgrade that moves the epoch can never silently desync the schedule.
EPOCH_START = datetime(2026, 7, 22, 9, 24, 31, tzinfo=timezone.utc)
try:
    _eps = get(f"{API}/cosmos/epochs/v1beta1/epochs")
    _wk = next((e for e in _eps.get("epochs", []) if e.get("identifier") == "week"), None)
    if _wk:
        _st = datetime.fromisoformat(_wk["start_time"].replace("Z", "+00:00")).replace(microsecond=0)
        if abs((_st - EPOCH_START).total_seconds()) > 60:
            print(f"collect: WARNING week epoch start on chain is {_st}, anchor is {EPOCH_START}", file=sys.stderr)
            EPOCH_START = _st
except Exception as _e:
    print(f"collect: epoch query failed ({_e}); using the anchor", file=sys.stderr)
week = int((datetime.now(timezone.utc) - EPOCH_START).total_seconds() // (7*86400)) + 1
sched = []
for w in range(1, week + 9):
    e = round(float(nb["minimum_coefficient"]) + float(nb["step"]) * (w - 1), 4)
    e = min(e, float(nb["maximum_coefficient"]))
    d = EPOCH_START + timedelta(days=7*(w-1))
    sched.append({"week": w, "date": d.strftime("%b %-d"), "iso": d.strftime("%Y-%m-%d"),
                  "ts": d.isoformat(), "height": None, "c": None,
                  "eta": e, "now": w == week, "next": w == week + 1, "past": w < week,
                  "pct": round(e*100, 1)})
# ── the block each epoch opened on, and the concentration measured there ─────
# Heights come from our own index, which is complete from genesis. The validator
# set at those heights comes from a public archive because our node is pruned and
# answers /validators only for recent heights. Both are immutable once the week is
# past, so a height is fetched exactly once and cached for good; an archive that is
# down costs a blank cell, never a failed run.
CHIST = os.path.join(STATE, "chist.json")
try:
    chist = json.load(open(CHIST))
except Exception:
    chist = {}

_ts = ",".join("'%s'" % r["ts"] for r in sched)
# ordinality, not the rendered timestamp: psql prints timestamptz in the server's
# own zone, and a '0' sentinel rather than '' because psql's field separator is
# whitespace to str.strip(), which would eat a trailing empty column
_hr = sql(f"""
WITH wk AS (SELECT t, i FROM unnest(ARRAY[{_ts}]::timestamptz[]) WITH ORDINALITY AS u(t, i))
SELECT wk.i::text, coalesce((SELECT b.height::text FROM block b
        WHERE b.chain_id='{CHAIN}' AND b.time >= wk.t ORDER BY b.time LIMIT 1), '0')
FROM wk ORDER BY wk.i;""")
_H = {int(i): int(h) for i, h in _hr if h != '0'}

def ratio_at(h):
    """Concentration of the bonded set at a past height, from the archive."""
    k = str(h)
    if k in chist:
        return chist[k]
    pw, page = [], 1
    while page <= 4:
        try:
            with urllib.request.urlopen(
                    f"{ARCHIVE}/validators?height={h}&per_page=100&page={page}", timeout=25) as r:
                d = json.loads(r.read(4_000_000))["result"]   # 100 validators is ~60 KB
        except Exception as ex:
            print(f"atomone-app: archive height {h}: {ex}", file=sys.stderr)
            return None
        pw += [int(v["voting_power"]) for v in d["validators"]]
        if len(pw) >= int(d["total"]): break
        page += 1
    n = len(pw)
    if n < 9: return None
    pw.sort(reverse=True)
    gg = n // 3; gg_lo = n - 2*gg
    hi_a = sum(pw[:gg]) / gg; lo_a = sum(pw[n-gg_lo:]) / gg_lo
    if not lo_a: return None
    chist[k] = round(hi_a / lo_a, 2)
    return chist[k]

for r in sched:
    # psql renders timestamptz in the server's own style, so match on the height we
    # asked for rather than on the text coming back
    r["height"] = _H.get(r["week"])
    if r["height"] and (r["past"] or r["now"]):
        r["c"] = ratio_at(r["height"])
_tmp = CHIST + ".tmp"
json.dump(chist, open(_tmp, "w"))
os.replace(_tmp, CHIST)

# the reconstruction must land on the live coefficient, or the anchor has drifted
recon = next((s["eta"] for s in sched if s["now"]), None)
if not TESTNET and (recon is None or abs(recon - coef) > 1e-9):
    die(f"schedule reconstruction {recon} != live coefficient {coef} - epoch anchor drifted")

# ── decentralisation, from OUR index (proposals, not stake) ───────────────────
rows = sql(f"""
WITH w AS (SELECT date_trunc('month', time) m, proposer_cons p, count(*)::numeric n
           FROM block WHERE chain_id='{CHAIN}' AND proposer_cons IS NOT NULL
             AND time > now() - interval '10 months' GROUP BY 1,2),
t AS (SELECT m, sum(n) s, count(*) c FROM w GROUP BY m),
r AS (SELECT w.m, n, sum(n) OVER (PARTITION BY w.m ORDER BY n DESC) cum,
             row_number() OVER (PARTITION BY w.m ORDER BY n DESC) rk FROM w)
SELECT to_char(t.m,'YYYY-MM'), t.c,
       (SELECT min(rk) FROM r WHERE r.m=t.m AND r.cum*3 > t.s),
       round((SELECT sum(n) FROM (SELECT n FROM w WHERE w.m=t.m ORDER BY n DESC LIMIT 10) q)/t.s*100,2)
FROM t ORDER BY t.m;""")
trend = [{"month": r[0], "proposers": int(r[1]), "nakamoto": int(r[2]), "top10": float(r[3])}
         for r in rows if r[2]]
if len(trend) < 3 and not TESTNET: die(f"only {len(trend)} months of proposal history - index incomplete")

# ── lifetime signing, over every block whose signatures we have indexed ──────
# "Expected" starts at the later of our signature coverage and the validator's
# first proposal, so a validator that joined last month is not marked absent for
# the months before it existed. The floor rises toward genesis as the backfill
# walks down; when it reaches height 1 this is literally since genesis.
lrows = sql(f"""
WITH cov AS (SELECT min(height) h FROM block WHERE chain_id='{CHAIN}' AND extract_version >= 3),
     tip AS (SELECT max(height) h FROM block WHERE chain_id='{CHAIN}'),
     fp  AS (SELECT proposer_cons c, min(height) h FROM block
             WHERE chain_id='{CHAIN}' AND proposer_cons IS NOT NULL GROUP BY 1)
SELECT fp.c,
       ((SELECT h FROM tip) - greatest(fp.h,(SELECT h FROM cov)))::text,
       (SELECT count(*) FROM missed_signature ms WHERE ms.chain_id='{CHAIN}'
         AND ms.cons_addr=fp.c AND ms.height >= greatest(fp.h,(SELECT h FROM cov)))::text
FROM fp;""")
life = {r[0]: (int(r[1]), int(r[2])) for r in lrows if int(r[1]) > 0}
_cov = sql(f"""SELECT min(height)::text, to_char(min(time),'Mon FMDD YYYY')
               FROM block WHERE chain_id='{CHAIN}' AND extract_version >= 3;""")
cov_h = int(_cov[0][0]) if _cov and _cov[0][0] else 0
coverage = {"from_height": cov_h, "from_date": _cov[0][1] if _cov else "",
            "genesis": cov_h <= 1}

# ── what each validator actually earned, epoch by epoch ─────────────────────
# APR_i(w) = base(w) x [(1-eta) + eta*S/(N*s_i)] x signed_fraction, where base is
# the chain-wide rate at that epoch's bonded total. Two honest limits, both
# carried into the page's wording: uptime only exists above the signature
# coverage floor, and historical supply is compounded back from today at the
# fixed inflation rather than queried, because the archive exposes no REST.
VSETS = os.path.join(STATE, "vsets.json")
try:
    vsets = json.load(open(VSETS))
except Exception:
    vsets = {}

def vset_at(h):
    k = str(h)
    if k in vsets: return vsets[k]
    got, page = {}, 1
    while page <= 4:
        try:
            with urllib.request.urlopen(
                    f"{ARCHIVE}/validators?height={h}&per_page=100&page={page}", timeout=30) as r:
                d = json.loads(r.read(4_000_000))["result"]   # 100 validators is ~60 KB
        except Exception as ex:
            print(f"atomone-app: archive set {h}: {ex}", file=sys.stderr); return None
        for v in d["validators"]:
            got[v["address"]] = int(v["voting_power"])
        if len(got) >= int(d["total"]): break
        page += 1
    vsets[k] = got
    return got

_done = [r for r in sched if r["height"] and (r["past"] or r["now"])]
earn = {}
for _i, _w in enumerate(_done):
    _h0 = _w["height"]
    _h1 = _done[_i+1]["height"] if _i+1 < len(_done) else head
    if _h0 < cov_h or _h1 <= _h0: continue
    _vs = vset_at(_h0)
    if not _vs: continue
    _S, _N = sum(_vs.values()), len(_vs)
    if not _S or not _N: continue
    _yrs = (len(_done) - 1 - _i) * 7 / 365.0
    _sup = supply / ((1 + infl) ** _yrs)
    _base = infl * (_sup / (_S * 1e6)) * (1 - tax)
    _miss = {r[0]: int(r[1]) for r in sql(f"""
        SELECT cons_addr, count(*)::text FROM missed_signature
        WHERE chain_id='{CHAIN}' AND height >= {_h0} AND height < {_h1} GROUP BY 1;""")}
    _blocks = _h1 - _h0
    for _a, _p in _vs.items():
        _up = 1 - _miss.get(_a, 0) / _blocks
        _apr = _base * ((1 - _w["eta"]) + _w["eta"] * _S / (_N * _p)) * max(0.0, _up)
        earn.setdefault(_a, []).append((_apr, _p))
_tmp = VSETS + ".tmp"
json.dump(vsets, open(_tmp, "w")); os.replace(_tmp, VSETS)

# ── per-validator history from our index ─────────────────────────────────────
srows = sql(f"""SELECT cons_addr, kind, count(*)::int,
                       max(height), to_char(max(time),'YYYY-MM-DD'), coalesce(sum(burned),0)::text
                FROM slash_event WHERE chain_id='{CHAIN}' GROUP BY cons_addr, kind;""")
hist = {}
for ca, kind, n, h, t, burned in srows:
    e = hist.setdefault(ca, {"jailed": 0, "slashed": 0, "last": None, "burned": 0})
    e["jailed" if kind == "jailed" else "slashed"] = int(n)
    if e["last"] is None or t > e["last"]: e["last"] = t; e["last_height"] = int(h)
    e["burned"] += int(burned or 0)

# LIFETIME, not a window. A "last 200k blocks" figure invites the question "why
# 200k?" and has no good answer; we index from height 1, so the honest number is
# every block the validator has ever proposed. Costs ~2s on 10.3M rows.
prows = sql(f"""SELECT proposer_cons, count(*)::int FROM block
                WHERE chain_id='{CHAIN}' AND proposer_cons IS NOT NULL
                GROUP BY proposer_cons;""")
prop = {r[0]: int(r[1]) for r in prows}
ptot = sum(prop.values()) or 1

# ── daily proposal activity, for the 30D / 3M strips ─────────────────────────
# There is NO per-block signature data in this index - it stores proposers, not
# commit signatures - so TRUE signing uptime exists only for the chain's own
# 10,000-block slashing window (below). Over longer spans the honest signal is
# proposal activity: a validator that is down proposes nothing at all, because a
# proposer that fails to propose is skipped and the slot passes to the next one.
# Even the smallest member of this set is expected to propose ~26 blocks a day,
# so a day with zero proposals is unambiguous downtime, not sampling noise. The
# page labels these two strips "days proposing", never "uptime".
UP_DAYS = 90
drows = sql(f"""SELECT proposer_cons, to_char(time AT TIME ZONE 'UTC','YYYY-MM-DD'), count(*)::int
                FROM block WHERE chain_id='{CHAIN}' AND proposer_cons IS NOT NULL
                  AND time > now() - interval '{UP_DAYS} days'
                GROUP BY 1,2;""")
_today = datetime.now(timezone.utc).date()
# sql() shells out to psql, so EVERY column arrives as a string - keying this
# join on date objects silently matched nothing and published a set where every
# validator looked dead for 90 days. Keep both sides ISO text.
_days  = [(_today - timedelta(days=i)).isoformat() for i in range(UP_DAYS - 1, -1, -1)]
_di    = {d: i for i, d in enumerate(_days)}
daily  = {}
for _ca, _d, _n in drows:
    if _d in _di:
        daily.setdefault(_ca, [0] * UP_DAYS)[_di[_d]] = int(_n)
# Blocks per day MEASURED, not assumed. Using the real per-day total means the
# newest day - which is always partial - normalises correctly instead of
# rendering as a false outage every single build.
_tot = [0] * UP_DAYS
for _ser in daily.values():
    for _i, _n in enumerate(_ser): _tot[_i] += _n
# A join that matches nothing looks exactly like a chain where nobody proposed.
# Refuse to publish that rather than paint 100 validators dark.
if sum(_tot) < UP_DAYS * 1000 and not TESTNET:
    die(f"daily rollup saw only {sum(_tot)} blocks across {UP_DAYS} days - "
        "proposer key or date join is broken")

def _strip(chex, share):
    """One digit per day, 0 = proposed nothing, 9 = at or above its expected rate."""
    ser = daily.get(chex, [0] * UP_DAYS)
    out = []
    for i, cnt in enumerate(ser):
        exp = max(1.0, _tot[i] * share)
        out.append(0 if not cnt else max(1, min(9, int(round(cnt / exp * 9)))))
    return "".join(str(x) for x in out)

# ── when each validator was created ──────────────────────────────────────────
# The staking module does not keep a creation time - `commission.update_time` is
# the last commission EDIT, not the join - so the only exact answer is the
# MsgCreateValidator transaction, which we have indexed from genesis.
#
# The tx signs with the ACCOUNT address (atone1...) while the validator is keyed
# by its OPERATOR address (atonevaloper1...). Both bech32-encode the same 20
# bytes, and the bech32 data charset excludes "1", so the separator is the first
# "1" and the payload between it and the 6-character checksum is identical in
# both. Matching on that payload avoids decoding and re-encoding entirely.
# An identity is either a 16-char PGP key suffix or a Keybase username. Both are
# usable; both also become a filename, so anything else is dropped rather than
# trusted into a path.
def _ident(raw):
    v = (raw or "").strip()
    return v if re.fullmatch(r"[0-9A-Za-z_.-]{2,32}", v) else ""

def _payload(addr):
    i = addr.find("1")
    return addr[i + 1:-6] if i > 0 and len(addr) > i + 7 else ""

crows = sql(f"""SELECT signer, to_char(min(time),'YYYY-MM-DD')
                FROM tx WHERE chain_id='{CHAIN}'
                  AND msg_types::text LIKE '%MsgCreateValidator%'
                GROUP BY signer;""")
created = {}
for _signer, _when in crows:
    pl = _payload(_signer)
    if pl:
        created[pl] = _when
# Genesis validators never sent that message, so they have no row. Their join is
# the chain's own first block - stated as such rather than left blank.
grow = sql(f"SELECT to_char(min(time),'YYYY-MM-DD') FROM block WHERE chain_id='{CHAIN}';")
GENESIS_DAY = grow[0][0] if grow and grow[0][0] else None

def _daysup(chex, k):
    ser = daily.get(chex, [0] * UP_DAYS)[-k:]
    return round(sum(1 for c in ser if c > 0) / max(1, len(ser)) * 100, 1)

# ── uptime, as the chain itself measures it ──────────────────────────────────
# missed_blocks_counter over signed_blocks_window is what the slashing module uses
# to decide jailing, so it is the definition that actually has consequences - not a
# proxy derived from proposal counts.
sp = get(f"{API}/cosmos/slashing/v1beta1/params")["params"]
WINDOW = int(sp["signed_blocks_window"])
sinfo = {}
for e in get(f"{API}/cosmos/slashing/v1beta1/signing_infos?pagination.limit=1000")["info"]:
    sinfo[e["address"]] = {"missed": int(e["missed_blocks_counter"]),
                           "tomb": bool(e.get("tombstoned"))}

# nakamoto coefficient from STAKE, for comparison
cum = 0; nk_stake = N
for i, v in enumerate(V, 1):
    cum += v["t"]
    if cum * 3 > S: nk_stake = i; break

# RATE OF CHANGE. Least squares, not endpoints: an endpoint slope swings with
# whichever months you happen to bracket, and this series is short enough that the
# choice changes the headline (-0.32 vs -0.78 vs -1.04 on the same data).
#
# The month the bonus started is PARTIAL - it began 2026-07-22 - so it belongs to
# neither window and is excluded from both. And a slope is only reported when there
# are enough points to mean anything; below MIN_FIT the page must say "too early"
# rather than print a number that is really one interval wearing a trend's clothes.
MIN_FIT = 4

# ── the same measurement, weekly, for the stretch since the bonus ────────────
# Months are too coarse to say anything yet: the bonus is eight weeks old, which
# is two whole months, and two points is one interval rather than a trend. The
# chain's own weekly epoch gives eight points over the same ground. The running
# week is excluded - a partial bucket reads as a dip that is really just fewer
# blocks in it.
_ep = EPOCH_START.strftime("%Y-%m-%d %H:%M:%S+00")
WEEKS_BACK = 26                      # half a year of the same measure before the bonus
wrows = sql(f"""
WITH w AS (SELECT floor(extract(epoch from (time - timestamptz '{_ep}'))/604800)::int wk,
                  proposer_cons p, count(*)::numeric n
           FROM block WHERE chain_id='{CHAIN}' AND proposer_cons IS NOT NULL
             AND time >= timestamptz '{_ep}' - interval '{7*WEEKS_BACK} days' GROUP BY 1,2),
t AS (SELECT wk, sum(n) s, count(*) c FROM w GROUP BY wk),
r AS (SELECT w.wk, n, sum(n) OVER (PARTITION BY w.wk ORDER BY n DESC) cum,
             row_number() OVER (PARTITION BY w.wk ORDER BY n DESC) rk FROM w)
SELECT t.wk::text, t.c::text,
       coalesce((SELECT min(rk) FROM r WHERE r.wk=t.wk AND r.cum*3 > t.s),0)::text,
       round((SELECT sum(n) FROM (SELECT n FROM w WHERE w.wk=t.wk ORDER BY n DESC LIMIT 10) q)
             /t.s*100,2)::text
FROM t WHERE t.wk < {week-1} ORDER BY t.wk;""")
weekly = [{"wk": int(r[0]), "week": int(r[0]) + 1,
           "date": (EPOCH_START + timedelta(days=7*int(r[0]))).strftime("%b %-d"),
           "proposers": int(r[1]), "nakamoto": int(r[2]), "top10": float(r[3])}
          for r in wrows if int(r[2])]
# the bonus went live at wk 0, so the split needs no date arithmetic
# the headline sentence: how the top-ten share moved over the last 90 days, as a
# relative change. 13 weekly points is 91 days - the closest the chain's own epoch
# grid gets - and the window is stated in the sentence so the two agree.
t10 = None
if len(weekly) >= 14:
    _b, _l = weekly[-14], weekly[-1]
    if _b["top10"]:
        t10 = {"pct": round((_l["top10"] - _b["top10"]) / _b["top10"] * 100, 1),
               "days": (_l["wk"] - _b["wk"]) * 7,
               "from": _b["top10"], "to": _l["top10"]}

# ── how many addresses are actually delegating ──────────────────────────────
# One address delegating to three validators is one delegator, not three, so the
# set is deduplicated across the whole validator list. A full enumeration costs
# about four seconds; a partial one would understate the count, so anything short
# of every validator answering publishes nothing rather than a low number.
import concurrent.futures as _cf

def _deleg(op):
    out, key = set(), ""
    for _ in range(40):
        u = (f"{API}/cosmos/staking/v1beta1/validators/{op}/delegations"
             f"?pagination.limit=1000"
             + (f"&pagination.key={urllib.parse.quote(key)}" if key else ""))
        d = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(u, timeout=40) as r:
                    d = json.loads(r.read()); break
            except Exception:
                time.sleep(0.4 * (attempt + 1))
        if d is None:
            return None
        for x in d["delegation_responses"]:
            out.add(x["delegation"]["delegator_address"])
        key = (d.get("pagination") or {}).get("next_key") or ""
        if not key:
            break
    return out

DELEGF = os.path.join(STATE, "delegators.json")
delegators = None
try:
    _cached = json.load(open(DELEGF))
    if time.time() - _cached.get("at", 0) < 3600:
        delegators = {"unique": _cached["unique"], "rows": _cached["rows"]}
except Exception:
    pass
try:
    if delegators is not None:
        raise StopIteration
    with _cf.ThreadPoolExecutor(3) as _ex:
        _sets = list(_ex.map(_deleg, [v["op"] for v in V]))
    if all(x is not None for x in _sets):
        _u = set()
        for x in _sets: _u |= x
        delegators = {"unique": len(_u), "rows": sum(len(x) for x in _sets)}
        _t = DELEGF + ".tmp"
        json.dump({"at": time.time(), **delegators}, open(_t, "w"))
        os.replace(_t, DELEGF)
    else:
        print("atomone-app: delegator count incomplete, keeping last", file=sys.stderr)
except StopIteration:
    pass
except Exception as _ex_err:
    print(f"atomone-app: delegator count: {_ex_err}", file=sys.stderr)

# ── where the stake moved over the same window the trend sentence measures ───
# The validator sets at the two ends of the 13-week window, differenced. "To the
# smaller end" is stake gained by validators outside the ten largest as they
# stood at the start - the group the bonus is meant to feed.
move13 = None
if len(weekly) >= 14:
    _wk0, _wk1 = weekly[-14]["wk"], weekly[-1]["wk"]
    _t0 = (EPOCH_START + timedelta(days=7*_wk0)).isoformat()
    _t1 = (EPOCH_START + timedelta(days=7*_wk1)).isoformat()
    _hh = sql(f"""
WITH wk AS (SELECT t, i FROM unnest(ARRAY['{_t0}','{_t1}']::timestamptz[])
            WITH ORDINALITY AS u(t, i))
SELECT wk.i::text, coalesce((SELECT b.height::text FROM block b
        WHERE b.chain_id='{CHAIN}' AND b.time >= wk.t ORDER BY b.time LIMIT 1), '0')
FROM wk ORDER BY wk.i;""")
    _H2 = {int(i): int(h) for i, h in _hh if h != '0'}

if move13 is None and len(weekly) >= 14 and len(_H2) == 2:
    _a, _b = vset_at(_H2[1]), vset_at(_H2[2])
    if _a and _b:
        _top10 = set(sorted(_a, key=lambda k: -_a[k])[:10])
        _grew = {k: _b.get(k, 0) - _a.get(k, 0) for k in set(_a) | set(_b)}
        move13 = {
            "weeks": (_wk1 - _wk0),
            "bonded_delta": sum(_b.values()) - sum(_a.values()),
            "to_small": sum(d for k, d in _grew.items() if d > 0 and k not in _top10),
            "from_top": -sum(d for k, d in _grew.items() if d < 0 and k in _top10),
            "grew": sum(1 for d in _grew.values() if d > 0),
            "shrank": sum(1 for d in _grew.values() if d < 0),
        }

wk_pre  = [w for w in weekly if w["wk"] <  0]
wk_post = [w for w in weekly if w["wk"] >= 0]
bonus_month = EPOCH_START.strftime("%Y-%m")
pre  = [t for t in trend if t["month"] <  bonus_month]
post = [t for t in trend if t["month"] >  bonus_month]
def slope(xs):
    n = len(xs)
    if n < MIN_FIT: return None
    mx = (n - 1) / 2.0
    my = sum(v["top10"] for v in xs) / n
    num = sum((i - mx) * (v["top10"] - my) for i, v in enumerate(xs))
    den = sum((i - mx) ** 2 for i in range(n))
    return round(num / den, 3) if den else None

def apr(t, e): return R*(1-e)/S + R*e/(N*t)

# A small stable number per validator, given on first sight and never reused. The alert
# links name a set of validators as a bitmap over these numbers (six per character of
# Telegram's 64-character start payload), so one link carries the whole set. The page and
# the bot both read the number from data.json, so they cannot disagree.
VIDS_PATH = os.path.join(STATE, "vids.json")
try:
    VIDS = {k: int(n) for k, n in json.load(open(VIDS_PATH)).items()}
except Exception:
    VIDS = {}
_next = max(VIDS.values(), default=-1) + 1
for v in V:                                   # rank order, so the first pass reads naturally
    if v["op"] not in VIDS:
        VIDS[v["op"]] = _next; _next += 1
_t = VIDS_PATH + ".tmp"
json.dump(VIDS, open(_t, "w")); os.replace(_t, VIDS_PATH)

# ── Network tabs ─────────────────────────────────────────────────────────────
# Proposers: the last 24 hours of blocks by proposer (uppercase hex, as the page's validators
# carry it). CometBFT's weighted round robin gives each validator its share of voting power,
# so the page sets each count against what that share predicts.
p24 = {r[0]: int(r[1]) for r in sql(f"""SELECT proposer_cons, count(*)::int FROM block
          WHERE chain_id='{CHAIN}' AND proposer_cons IS NOT NULL AND time > now() - interval '24 hours'
          GROUP BY 1;""")}
# Activity: transactions and blocks per hour over the last 7 days, oldest first
act7 = [[int(r[0]), int(r[1]), int(r[2])] for r in sql(f"""SELECT extract(epoch FROM date_trunc('hour', time))::bigint,
          coalesce(sum(tx_count), 0)::int, count(*)::int FROM block
          WHERE chain_id='{CHAIN}' AND time > now() - interval '7 days' GROUP BY 1 ORDER BY 1;""")]
# The last 10,000 blocks in 100 stretches of 100, counted back from the newest: transactions, blocks, blocks that carried any. Through
# the time index (30 hours covers 10,000 blocks at up to ~10 s each): by height alone the planner,
# on the table's statistics, scanned the whole table (5 s against 0.15 s)
b10k = [[int(r[0]), int(r[1]), int(r[2]), int(r[3])] for r in sql(f"""WITH w AS (SELECT height, tx_count FROM block
          WHERE chain_id='{CHAIN}' AND time > now() - interval '30 hours'),
     top AS (SELECT max(height) h FROM w)
   SELECT min(height), coalesce(sum(tx_count), 0)::int, count(*)::int, count(*) FILTER (WHERE tx_count > 0)::int
   FROM w, top WHERE height > top.h - 10000 GROUP BY (top.h - height) / 100 ORDER BY 1;""")]
# Activity since genesis: transactions and blocks per day, kept in state/txdaily.json - the whole
# history once (a ~7 s scan), then only the last two days on each build
TXD = os.path.join(STATE, "txdaily.json")
txday = None
try:
    txd = json.load(open(TXD)) if os.path.exists(TXD) else {}
    recent = "AND time >= date_trunc('day', now()) - interval '2 days'" if txd else ""
    for r in sql(f"""SELECT to_char(date_trunc('day', time), 'YYYY-MM-DD'), coalesce(sum(tx_count), 0)::int, count(*)::int
                     FROM block WHERE chain_id='{CHAIN}' {recent} GROUP BY 1;"""):
        txd[r[0]] = [int(r[1]), int(r[2])]
    _t = TXD + ".tmp"; json.dump(txd, open(_t, "w")); os.replace(_t, TXD)
    txday = [[d] + txd[d] for d in sorted(txd)]
except Exception as e:
    print(f"atomone-app: daily activity skipped ({e})", file=sys.stderr)
# Economics: today's supply, stake and pools, kept one point a day in state/econ.json (weekly
# before 2026-09-26, backfilled from the archive by dev/econ_backfill.py). A failure here
# costs the tab, never the build.
ECON = os.path.join(STATE, "econ.json")
econ = None
try:
    phs = int(get(f"{API}/cosmos/bank/v1beta1/supply/by_denom?denom=uphoton")["amount"]["amount"])
    cpp = 0.0
    for c in get(f"{API}/cosmos/distribution/v1beta1/community_pool").get("pool", []):
        if c.get("denom") == "uphoton":
            cpp = float(c["amount"])
    conv = float(get(f"{API}/atomone/photon/v1/conversion_rate")["conversion_rate"])
    eday = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ehist = json.load(open(ECON)) if os.path.exists(ECON) else []
    ehist = [p for p in ehist if p["d"] != eday] + [{"d": eday, "h": head, "atone": supply, "photon": phs,
            "bonded": S, "pool": round(cpool), "pool_ph": round(cpp)}]
    ehist.sort(key=lambda p: p["h"])
    _t = ECON + ".tmp"; json.dump(ehist, open(_t, "w")); os.replace(_t, ECON)
    econ = {"conv": conv, "hist": ehist}
except Exception as e:
    print(f"atomone-app: economics skipped ({e})", file=sys.stderr)

out = {
  "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
  "chain": CHAIN, "height": head,
  "eta": {"now": coef, "step": float(nb["step"]), "min": float(nb["minimum_coefficient"]),
          "max": float(nb["maximum_coefficient"]), "enabled": bool(nb["enabled"]),
          "epoch": nb["period_epoch_identifier"], "week": week,
          # which day of the running week we are on, so the week number can be
          # checked rather than guessed at from the calendar
          "week_day": int((datetime.now(timezone.utc)
                           - (EPOCH_START + timedelta(days=7*(week-1)))).days) + 1,
          "bonus_month": EPOCH_START.strftime("%Y-%m")},
  # the alert bot writes its own username here once it has authenticated, so the
  # page's deep link can never point at a bot that is not actually running
  "bot": (lambda f: (json.load(open(f)).get("username")
                     if os.path.exists(f) else None))(os.path.join(STATE, "bot.json")),
  "schedule": sched,
  # HIGHEST REACHED is not simply the current value: the ratio can fall as well
  # as rise, and if it ever does, the reconstruction below stops matching the live
  # coefficient and collect.py refuses to publish rather than draw a wrong history.
  # So while this equals eta.now, that is a fact about the chain so far, not an
  # assumption baked into the page.
  "eta_stats": {"floor": float(nb["minimum_coefficient"]),
                "cap": float(nb["maximum_coefficient"]),
                "highest": max(r["eta"] for r in sched if not (r["next"] or r["week"] > week)),
                "highest_week": week,
                "today": datetime.now(timezone.utc).strftime("%b %-d"),
                "weeks_to_cap": int(round((float(nb["maximum_coefficient"]) - coef)
                                          / float(nb["step"]))) if float(nb["step"]) else None,
                "monotonic_so_far": True},
  "p24": p24, "act7": act7, "txday": txday, "b10k": b10k, "econ": econ,
  # every block the index holds a proposer for, and how many validators ever proposed one
  "prop_all": {"blocks": sum(prop.values()), "proposers": len(prop)},
  "set": {"n": N, "bonded": S, "supply": supply, "bonded_pct": round(S/supply*100, 2),
          "mean": MEAN, "base_apr": BASE, "reward_pool": R,
          # how many validators SIT BELOW the average size - the ones a higher
          # coefficient pays more. Not the same set as the concentration thirds.
          "below_mean": sum(1 for v in V if v["t"] < MEAN),
          "inflation": infl, "community_tax": tax,
          "min_commission": mincom, "community_pool": cpool,
          "not_bonded": int(pool["not_bonded_tokens"])},
  "rule": {"ratio": ratio, "threshold": 3.0, "rising": rising,
                 "high_avg": Hi/g, "low_avg": Lo/gl, "group": g, "group_lo": gl,
                 "move_to_reverse": move, "move_pct_bonded": move/S*100,
                 "move_pct_top": move/Hi*100, "move_each": move/g,
                 "low_avg_after": MEAN + _lam*(Lo/gl - MEAN),
                 "move_from": move_from, "move_to": move_to},
  "nakamoto": {"stake": nk_stake, "proposals": trend[-1]["nakamoto"] if trend else None,
               "top10_now": trend[-1]["top10"] if trend else None, "top10_first": trend[0]["top10"] if trend else None,
               "rate_before": slope(wk_pre), "n_before": len(wk_pre),
               # weekly on both sides: two months is one monthly interval
               "rate_after": slope(wk_post), "n_after": len(wk_post),
               "after_unit": "wk", "weekly": weekly, "t10_change": t10,
               "min_fit": MIN_FIT, "partial_month": bonus_month,
               "bonus_from": EPOCH_START.strftime("%Y-%m-%d")},
  "trend": trend,
  "move13": move13,
  "delegators": delegators,
  "coverage": coverage,
  "validators": [dict(
      m=v["m"], t=v["t"], c=v["c"], op=v["op"], web=v["web"], det=v["det"], vid=VIDS[v["op"]],
      apr=apr(v["t"], coef), net=apr(v["t"], coef)*(1-v["c"]),
      vp=round(v["t"]/S*100, 3), rank=i+1,
      below=v["t"] < MEAN,
      id=_ident(v["id"]),
      # hex consensus address, so the page can match this validator against the
      # signatures in a live commit without deriving it in the browser
      chex=v["chex"],
      up=round((WINDOW - sinfo.get(v["cons"], {}).get("missed", 0)) / WINDOW * 100, 2),
      # signing over every indexed block, not just the recent window
      life_up=(round((life[v["chex"]][0] - life[v["chex"]][1]) / life[v["chex"]][0] * 100, 3)
               if v["chex"] in life else None),
      life_n=life.get(v["chex"], (0, 0))[0],
      life_missed=life.get(v["chex"], (0, 0))[1],
      earn_avg=((sum(a*p for a, p in earn[v["chex"]]) / sum(p for _, p in earn[v["chex"]]))
                if earn.get(v["chex"]) else None),
      earn_hi=(max([a for a, p in earn[v["chex"]] if p >= 0.1 * v["t"] / 1e6] or
                   [a for a, _ in earn[v["chex"]]]) if earn.get(v["chex"]) else None),
      earn_lo=(min([a for a, p in earn[v["chex"]] if p >= 0.1 * v["t"] / 1e6] or
                   [a for a, _ in earn[v["chex"]]]) if earn.get(v["chex"]) else None),
      earn_n=len(earn.get(v["chex"], [])),
      missed=sinfo.get(v["cons"], {}).get("missed", 0),
      tomb=sinfo.get(v["cons"], {}).get("tomb", False),
      prop=prop.get(v["chex"], 0), prop_pct=round(prop.get(v["chex"], 0)/ptot*100, 3),
      jail=hist.get(v["cons"], {}).get("jailed", 0),
      slash=hist.get(v["cons"], {}).get("slashed", 0),
      last_slash=hist.get(v["cons"], {}).get("last"),
      burned=hist.get(v["cons"], {}).get("burned", 0),
      bars=_strip(v["chex"], v["t"]/S), d30=_daysup(v["chex"], 30), d90=_daysup(v["chex"], UP_DAYS),
      joined=created.get(_payload(v["op"])) or GENESIS_DAY,
      genesis=_payload(v["op"]) not in created,
  ) for i, v in enumerate(V)],
  "sign_window": WINDOW,
  "uptime_days": UP_DAYS, "uptime_from": _days[0],
}

# Refresh the avatar cache. Only unseen identities cost a request, so this is a
# no-op in steady state; a failure here is cosmetic and must not fail the build.
try:
    ids = "\n".join(_ident(v["id"]) for v in V if _ident(v["id"]))
    subprocess.run(["python3", os.path.join(os.path.dirname(os.path.abspath(__file__)), "avatars.py")],
                   input=ids, text=True, timeout=240, capture_output=True)
except Exception as e:
    print(f"atomone-app: avatar refresh skipped ({e})", file=sys.stderr)

# Which identities ended up with a tile on disk. Rendering an <img> for one that
# does not exist would put a broken-image request on every cell that lacks an avatar.
AVDIR = os.path.join(STATE, "avatars")
HAVE_AV = {f[:-4] for f in os.listdir(AVDIR)} if os.path.isdir(AVDIR) else set()
for v in out["validators"]:
    v["av"] = bool(v["id"]) and v["id"] in HAVE_AV
# testnet: what only our index knows is not known - None, which the page shows as N/A
if TESTNET:
    for v in out["validators"]:
        for k in ("prop", "prop_pct", "jail", "last_slash", "burned", "bars", "d30", "d90", "joined",
                  "life_up", "life_n", "life_missed", "earn_avg", "earn_hi", "earn_lo"):
            if k in v: v[k] = None

os.makedirs(OUT, exist_ok=True)
tmp = os.path.join(OUT, ".data.json.tmp")
with open(tmp, "w") as f: json.dump(out, f, separators=(",", ":"))
os.replace(tmp, os.path.join(OUT, "data.json"))
print(f"atomone-app: ok height={head} eta={coef} ratio={ratio:.2f} "
      f"validators={N} trend_months={len(trend)}")
