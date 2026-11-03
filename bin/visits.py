#!/usr/bin/env python3
"""Visits to the app, from nginx's own hit log (no IP, no address is ever in it).

Each line: [time] "GET /hit?e=view&p=staking/bonus&v=abc123" "user agent"  (the testnet's under /testnet/hit).
Prints per day: visitors (distinct browser ids), new ones, page views, wallet connects; then the top pages.

  visits.py [days]       default 14
  visits.py --json       the same as JSON, for a page to read
"""
import glob, gzip, json, os, re, sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

LOG = os.environ.get("HITS_LOG", "/var/log/nginx/atomone-hits.log")
BOT = re.compile(r"bot|crawl|spider|slurp|curl|wget|python|node-fetch|Go-http|HeadlessChrome|Uptime-Kuma|axios", re.I)
LINE = re.compile(r'^\[(?P<t>[^\]]+)\] "GET (?P<u>\S+)[^"]*" "(?P<ua>[^"]*)"')


def lines():
    for f in sorted(glob.glob(LOG + "*"), reverse=True):
        op = gzip.open if f.endswith(".gz") else open
        with op(f, "rt", errors="replace") as fh:
            yield from fh


def main():
    as_json = "--json" in sys.argv
    days = next((int(a) for a in sys.argv[1:] if a.isdigit()), 14)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).date()
    first = {}                      # browser id -> first day seen (over the whole log)
    day = defaultdict(lambda: {"ids": set(), "views": 0, "wallets": set(), "net": Counter()})
    pages = Counter()
    for ln in lines():
        m = LINE.match(ln)
        if not m or BOT.search(m["ua"]):
            continue
        try:
            d = datetime.strptime(m["t"], "%d/%b/%Y:%H:%M:%S %z").date()
        except ValueError:
            continue
        u = urlsplit(m["u"]); q = parse_qs(u.query)
        vid = (q.get("v") or ["-"])[0][:16]; ev = (q.get("e") or [""])[0]
        if vid == "-":
            continue
        first[vid] = min(first.get(vid, d), d)
        if d < since:
            continue
        D = day[d]; D["ids"].add(vid)
        D["net"]["testnet" if u.path.startswith("/testnet/") else "mainnet"] += 1
        if ev == "view":
            D["views"] += 1; pages[(q.get("p") or ["?"])[0][:40]] += 1
        elif ev == "wallet":
            D["wallets"].add(vid)
    rows = [{"day": str(d), "visitors": len(D["ids"]), "new": sum(1 for v in D["ids"] if first[v] == d),
             "views": D["views"], "wallets": len(D["wallets"]), "testnet_hits": D["net"]["testnet"]}
            for d, D in sorted(day.items())]
    total = {"visitors": len({v for D in day.values() for v in D["ids"]}),
             "returning": len({v for D in day.values() for v in D["ids"] if first[v] < since}),
             "top_pages": pages.most_common(10)}
    if as_json:
        print(json.dumps({"days": rows, "total": total})); return
    print(f"{'day':<11}{'visitors':>9}{'new':>6}{'views':>7}{'wallets':>9}")
    for r in rows:
        print(f"{r['day']:<11}{r['visitors']:>9}{r['new']:>6}{r['views']:>7}{r['wallets']:>9}")
    print(f"\n{days} days: {total['visitors']} distinct visitors, {total['returning']} first seen before that")
    for p, n in total["top_pages"]:
        print(f"  {n:>6}  {p}")


if __name__ == "__main__":
    main()
