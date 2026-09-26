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
gzips to 1.4KB, against a 5.8s block time.

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
UP_N = int(os.environ.get("LIVE_UP_BLOCKS", "120"))


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
    v = {x["operator_address"][-6:]: int(x["tokens"])
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
# each height is read once (one /block from our own node per new block; 120 once at start)
# and kept. Published as "up": [[height, signed, validators, "HEX,HEX" of those who did not
# sign], block time in epoch ms], oldest first - every visitor reads it from this file instead
# of asking the node. The time is block h's own header time: consecutive rows give the block time.
_up = {}


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
        _up[h] = [h - 1, len(sigs) - len(miss), len(sigs), ",".join(a for a in miss if a), ms(b["header"]["time"])]
    for k in [k for k in _up if k <= head - UP_N]:
        del _up[k]
    return [_up[k] for k in sorted(_up)]


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
                snap["up"] = uptime(snap["h"])
            except Exception as e:      # the stake vector matters more than the graph
                print(f"live: uptime: {e}", file=sys.stderr, flush=True)
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
