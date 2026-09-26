#!/usr/bin/env python3
"""econ_backfill: one point a week of AtomOne's economics, from genesis to today, into
/srv/atomone-app/state/econ.json - the history the Network Economics tab draws.

Our own API node is pruned (historical heights answer "version does not exist"), so the
points come from the public citizenweb3 archive at the first block of each week (heights from
the indexer's block table). Four reads a point, one every 0.4 s: ~100 weeks is ~3 minutes,
once. collect.py then adds today's point on every build, one per day.

usage (as the app's user, with its env):  python3 dev/econ_backfill.py
It merges into an existing file (a point already there for that date is kept) and never
touches the network when a week is already present.
"""
import json, os, subprocess, sys, time, urllib.parse, urllib.request

ARCH = os.environ.get("ATOMONE_ARCHIVE_API", "https://api.atomone-archive.citizenweb3.com")
DSN = os.environ["ATOMONE_APP_DSN"]
ECON = "/srv/atomone-app/state/econ.json"
UA = "gata-atomone-app/1.0 (+https://atomone.gatahub.zone/)"

# the password travels in PGPASSWORD, never in argv (world-readable in /proc)
u = urllib.parse.urlparse(DSN)
env = dict(os.environ, PGPASSWORD=urllib.parse.unquote(u.password or ""))
dsn = u._replace(netloc="{}@{}{}".format(u.username, u.hostname, f":{u.port}" if u.port else "")).geturl()

def sql(q):
    p = subprocess.run(["psql", dsn, "-tAF", "\x1f", "-c", q], capture_output=True, text=True, env=env, timeout=600)
    if p.returncode:
        sys.exit("sql: " + p.stderr.strip()[:200])
    return [l.split("\x1f") for l in p.stdout.strip().split("\n") if l]

def get(path, h):
    r = urllib.request.Request(ARCH + path, headers={"User-Agent": UA, "x-cosmos-block-height": str(h)})
    with urllib.request.urlopen(r, timeout=30) as f:
        return json.load(f)

weeks = sql("""SELECT to_char(date_trunc('week', time), 'YYYY-MM-DD'), min(height) FROM block
               WHERE chain_id='atomone-1' GROUP BY 1 ORDER BY 1;""")
hist = json.load(open(ECON)) if os.path.exists(ECON) else []
have = {p["d"] for p in hist}
got = 0
for d, h in weeks:
    h = max(2, int(h))
    if d in have:
        continue
    try:
        atone = int(get("/cosmos/bank/v1beta1/supply/by_denom?denom=uatone", h)["amount"]["amount"]); time.sleep(.4)
        photon = int(get("/cosmos/bank/v1beta1/supply/by_denom?denom=uphoton", h)["amount"]["amount"]); time.sleep(.4)
        bonded = int(get("/cosmos/staking/v1beta1/pool", h)["pool"]["bonded_tokens"]); time.sleep(.4)
        pool = {c["denom"]: float(c["amount"]) for c in get("/cosmos/distribution/v1beta1/community_pool", h).get("pool", [])}
        time.sleep(.4)
    except Exception as e:
        print(f"  {d} h={h}: {e}", file=sys.stderr)
        continue
    hist.append({"d": d, "h": h, "atone": atone, "photon": photon, "bonded": bonded,
                 "pool": round(pool.get("uatone", 0)), "pool_ph": round(pool.get("uphoton", 0))})
    got += 1
    print(f"  {d} h={h} atone={atone/1e6:,.0f} photon={photon/1e6:,.0f}", flush=True)
hist.sort(key=lambda p: p["h"])
tmp = ECON + ".tmp"
json.dump(hist, open(tmp, "w")); os.replace(tmp, ECON)
print(f"econ_backfill: {got} new points, {len(hist)} in all")
