#!/usr/bin/env python3
"""
Publish the live stake vector, every few seconds, as a static file.

WHY THIS EXISTS. Every delegation changes a validator's stake, which changes its
rank AND its APR - and under the Nakamoto Bonus it changes everyone else's too,
because the bonus is a share of one pool. With many people delegating at once the
answer to "where should this go" is genuinely moving, so a page rebuilt every 15
minutes cannot be trusted to answer it.

WHY IT IS STILL A STATIC FILE. Everything the page draws is a pure function of a
small vector: each validator's stake, the bonded total, the validator count, the
coefficient and the reward pool. The browser already computes ranks, APRs,
concentration and the map from exactly those inputs. So the fast path does not
need a server - it needs this vector kept fresh. Fetching it costs ~0.11s and it
gzips to 1.4KB, against a 5.8s block time (about 3.7KB since 2026-10-01, keyed by
full operator addresses).

This process holds NO database credential and talks only to our own node.
"""
import datetime, json, os, sys, time, urllib.parse, urllib.request

RPC = os.environ["ATOMONE_RPC"]
API = os.environ["ATOMONE_API"]
OUT = os.environ.get("OUT_DIR", "/srv/atomone-app/web")
EVERY = float(os.environ.get("LIVE_SECONDS", "6"))      # one block
CHAIN = os.environ.get("CHAIN_ID", "atomone-1")
DST = os.path.join(OUT, "live.json")
# How many recent blocks the network-uptime graph shows (~12 minutes at 6 s a block).
UP_N = int(os.environ.get("LIVE_UP_BLOCKS", "100"))


def get(url, timeout=12):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read())


def snapshot():
    st = get(f"{RPC}/status")["result"]
    if st["node_info"]["network"] != CHAIN:
        raise RuntimeError(f"node serves {st['node_info']['network']}")
    if st["sync_info"]["catching_up"]:
        raise RuntimeError("node catching up")
    vs, key = [], ""
    while True:
        u = (f"{API}/cosmos/staking/v1beta1/validators"
             f"?status=BOND_STATUS_BONDED&pagination.limit=200")
        if key:
            u += "&pagination.key=" + urllib.parse.quote(key)
        d = get(u)
        vs += d["validators"]
        key = d["pagination"].get("next_key")
        if not key:
            break
    # keyed by the full operator address since 2026-10-01 (audit H1); the page still reads the older
    # six-character keys while a live.json of that shape is served
    v = {x["operator_address"]: int(x["tokens"])
         for x in vs if not x.get("jailed")}
    if len(v) < 3:
        raise RuntimeError(f"only {len(v)} bonded validators")
    tax = float(get(f"{API}/cosmos/distribution/v1beta1/params")["params"]["community_tax"])
    prov = float(get(f"{API}/cosmos/mint/v1beta1/annual_provisions")["annual_provisions"])
    eta = float(get(f"{API}/cosmos/distribution/v1beta1/nakamoto_bonus_coefficient")["coefficient"])
    return {
        "h": int(st["sync_info"]["latest_block_height"]),
        "t": st["sync_info"]["latest_block_time"],
        "eta": eta,
        "n": len(v),
        "s": sum(v.values()),
        "r": prov * (1.0 - tax),
        "v": v,
    }


# Network uptime, block by block: who signed each commit. A block never changes once made, so
# each height is read once (one /block from our own node per new block; 100 once at start)
# and kept. Published as "up": [[height, signed, validators, "HEX,HEX" of those who did not
# sign], block time in epoch ms, proposer (index into "px"), transactions, gas used, PHOTON fees
# in uphoton (-1 = unknown)], oldest first - every visitor reads it from this file instead of
# asking the node. From the time on, the fields are block h's own: consecutive times give the
# block time, and the proposer, transactions, gas and fees are the block's that carries the commit.
_up = {}
# the real block pace against x/mint's blocks_per_year (audit 2026-10-13): the chain credits
# annual_provisions/blocks_per_year EVERY block, and blocks arrive ~20% faster than the parameter says, so the
# nominal pool understated every APR. The factor comes from the up-list's own timestamps (~100 blocks); the
# parameter is re-read daily. Unreadable -> the last factor, or nominal.
_mint = {"at": 0.0, "bpy": 0.0, "f": 1.0}


def pace_factor():
    try:
        if time.time() - _mint["at"] > 86400:
            _mint["bpy"] = float(get(f"{API}/cosmos/mint/v1beta1/params")["params"]["blocks_per_year"])
            _mint["at"] = time.time()
        ks = sorted(_up)
        if len(ks) >= 20 and _mint["bpy"]:
            dt = (_up[ks[-1]][4] - _up[ks[0]][4]) / 1000.0
            if dt > 0:
                _mint["f"] = max(0.8, min(1.6, (ks[-1] - ks[0]) / dt * 31_557_600 / _mint["bpy"]))
    except Exception as e:
        print(f"live: pace: {e}", file=sys.stderr, flush=True)
    return _mint["f"]


def ms(t):
    """RFC 3339 with nanoseconds (2026-09-26T08:05:45.123456789Z) -> epoch milliseconds"""
    d, _, f = t.rstrip("Z").partition(".")
    return int(datetime.datetime.strptime(d, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=datetime.timezone.utc).timestamp() * 1000) + int((f + "000")[:3])


def valset(h):
    """the validator set's addresses at height h, in the set's own order"""
    out, page = [], 1
    while True:
        r = get(f"{RPC}/validators?height={h}&per_page=100&page={page}", timeout=8)["result"]
        out += [v["address"] for v in r["validators"]]
        if len(out) >= int(r["total"]) or not r["validators"]:
            return out
        page += 1


def uptime(head):
    for h in range(max(1, head - UP_N + 1), head + 1):
        if h in _up:
            continue
        try:
            b = get(f"{RPC}/block?height={h}", timeout=8)["result"]["block"]
        except Exception:
            continue                    # a gap shows as a gap; the next tick tries again
        sigs = (b.get("last_commit") or {}).get("signatures") or []
        if not sigs:
            continue
        miss = [x.get("validator_address", "") for x in sigs if x.get("block_id_flag") != 2]
        # an ABSENT vote (flag 1) carries no address: the signatures are in the validator set's
        # order, so the set at the commit's height names it
        if any(not a for a in miss):
            try:
                vs = valset(int(b["last_commit"]["height"]))
                miss = [x.get("validator_address") or (vs[i] if i < len(vs) else "")
                        for i, x in enumerate(sigs) if x.get("block_id_flag") != 2]
            except Exception:
                pass                    # unnamed stays unnamed; the count is still right
        # the commit in block h is the vote on block h-1: that is the height it describes
        # and block h itself: who proposed it, its transactions, the gas they used, the PHOTON
        # they paid (one /block_results, only for a block that has transactions)
        ntx, gas, fee = len((b.get("data") or {}).get("txs") or []), 0, 0
        if ntx:
            try:
                res = get(f"{RPC}/block_results?height={h}", timeout=8)["result"]
                for t in res.get("txs_results") or []:
                    gas += int(t.get("gas_used") or 0)
                    for e in t.get("events") or []:
                        if e.get("type") != "tx":
                            continue
                        for a in e.get("attributes") or []:
                            if a.get("key") == "fee":
                                fee += sum(int(c[:-7]) for c in str(a.get("value") or "").split(",")
                                           if c.endswith("uphoton") and c[:-7].isdigit())
            except Exception:
                gas = fee = -1          # unknown, not zero
        _up[h] = [h - 1, len(sigs) - len(miss), len(sigs), ",".join(a for a in miss if a), ms(b["header"]["time"]),
                  b["header"].get("proposer_address", ""), ntx, gas, fee]
    for k in [k for k in _up if k <= head - UP_N]:
        del _up[k]
    return [_up[k] for k in sorted(_up)]


def pack(rows):
    """the proposer as an index into one list of addresses ("px"), so 100 rows do not carry
    100 forty-character strings to every visitor every block"""
    px, ix, out = [], {}, []
    for r in rows:
        a = r[5]
        if a not in ix:
            ix[a] = len(px); px.append(a)
        out.append(r[:5] + [ix[a]] + r[6:])
    return out, px


def write(obj):
    # atomic, same as every other published file here
    tmp = DST + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    os.replace(tmp, DST)


def main():
    fails = 0
    while True:
        t0 = time.time()
        try:
            snap = snapshot()
            try:
                snap["up"], snap["px"] = pack(uptime(snap["h"]))
            except Exception as e:      # the stake vector matters more than the graph
                print(f"live: uptime: {e}", file=sys.stderr, flush=True)
            snap["r"] *= pace_factor()  # the pool at the REAL block pace (audit 2026-10-13)
            write(snap)
            fails = 0
        except Exception as e:
            fails += 1
            # A stale live.json is better than a wrong one: leave the last good
            # file in place and let the page notice its own staleness.
            print(f"live: {e}", file=sys.stderr, flush=True)
            if fails >= 20:
                sys.exit(1)             # let systemd restart us
        time.sleep(max(1.0, EVERY - (time.time() - t0)))


if __name__ == "__main__":
    main()
