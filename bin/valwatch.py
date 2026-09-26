#!/usr/bin/env python3
"""valwatch: every AtomOne validator, watched for real downtime, alerts to Discord.

Every WATCH_SECONDS (60) it reads each validator's missed-block counter from the chain
(x/slashing signing infos: the misses in the rolling window of signed_blocks_window blocks)
and keeps ~70 minutes of samples. Not every miss: a validator is reported when it is DOWN -
it missed at least 90% of the last DOWN_BLOCKS (300, about 30 minutes) - and again when it
signs again. CRITICAL when its misses reach CRIT_FRACTION (0.5) of the window, which is half
of the 10,000-block window (jailing comes at 9,500). Jailings and tombstonings always.

State survives restarts (STATE_DIR/valwatch-<net>.json), so an incident is reported once.
The first 30 minutes after a fresh start cannot see a downtime yet; criticals and jailings
standing at start are reported once.

    NET=mainnet|testnet  ATOMONE_API  ATOMONE_RPC  DISCORD_WEBHOOK (via notify)
    valwatch.py            run forever
    valwatch.py --once     one pass, print what it sees, send nothing
    valwatch.py --test     send one test message to Discord
"""
import base64, hashlib, json, os, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import notify

NET = os.environ.get("NET", "mainnet")
API = os.environ.get("ATOMONE_API", "https://atomone-api.gatadao.com").rstrip("/")
RPC = os.environ.get("ATOMONE_RPC", "http://127.0.0.1:23957").rstrip("/")
CHAIN = os.environ.get("CHAIN_ID", "atomone-1" if NET == "mainnet" else "atomone-testnet-1")
EVERY = float(os.environ.get("WATCH_SECONDS", "60"))
DOWN_BLOCKS = int(os.environ.get("DOWN_BLOCKS", "300"))
DOWN_SHARE = float(os.environ.get("DOWN_SHARE", "0.9"))
CRIT_FRACTION = float(os.environ.get("CRIT_FRACTION", "0.5"))
STATE = os.path.join(os.environ.get("STATE_DIR", "/srv/atomone-app/state"), "valwatch-%s.json" % NET)
KEEP_S = 70 * 60
SITE = os.environ.get("SITE_URL", "https://atomone.gatahub.zone")


def log(*a): print("valwatch:", *a, flush=True)


def get(url, timeout=20):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"accept": "application/json"}), timeout=timeout) as r:
        return json.load(r)


# ── addresses: a consensus pubkey -> its atonevalcons bech32 ─────────────────
CS = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
def _polymod(v):
    g = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]; c = 1
    for x in v:
        b = c >> 25; c = (c & 0x1ffffff) << 5 ^ x
        for i in range(5): c ^= g[i] if (b >> i) & 1 else 0
    return c
def bech32(hrp, data):
    acc = bits = 0; out = []
    for b in data:
        acc = (acc << 8) | b; bits += 8
        while bits >= 5: bits -= 5; out.append((acc >> bits) & 31)
    if bits: out.append((acc << (5 - bits)) & 31)
    ex = [ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp]
    pm = _polymod(ex + out + [0] * 6) ^ 1
    return hrp + "1" + "".join(CS[d] for d in out + [(pm >> 5 * (5 - i)) & 31 for i in range(6)])
def cons_of(pk):
    raw = base64.b64decode(pk["key"])
    return bech32("atonevalcons", hashlib.sha256(raw).digest()[:20])


def snapshot():
    st = get(RPC + "/status")["result"]
    if st["node_info"]["network"] != CHAIN:
        raise RuntimeError("node serves %s, expected %s" % (st["node_info"]["network"], CHAIN))
    height = int(st["sync_info"]["latest_block_height"])
    window = int(get(API + "/cosmos/slashing/v1beta1/params")["params"]["signed_blocks_window"])
    vals, key = {}, ""
    while True:
        d = get(API + "/cosmos/staking/v1beta1/validators?pagination.limit=500" + ("&pagination.key=" + urllib.parse.quote(key) if key else ""))
        for v in d["validators"]:
            try:
                vals[cons_of(v["consensus_pubkey"])] = {"m": v["description"]["moniker"].strip()[:60], "op": v["operator_address"],
                                                        "bonded": v["status"] == "BOND_STATUS_BONDED", "jailed": bool(v.get("jailed"))}
            except Exception:
                pass
        key = (d.get("pagination") or {}).get("next_key")
        if not key: break
    miss, tomb, key = {}, {}, ""
    while True:
        d = get(API + "/cosmos/slashing/v1beta1/signing_infos?pagination.limit=500" + ("&pagination.key=" + urllib.parse.quote(key) if key else ""))
        for s in d["info"]:
            miss[s["address"]] = int(s.get("missed_blocks_counter") or 0)
            tomb[s["address"]] = bool(s.get("tombstoned"))
        key = (d.get("pagination") or {}).get("next_key")
        if not key: break
    return {"t": int(time.time()), "h": height, "window": window, "vals": vals, "miss": miss, "tomb": tomb}


def load():
    try: return json.load(open(STATE))
    except Exception: return {"samples": [], "inc": {}, "seen": {}, "api_down": 0}


def save(s):
    tmp = STATE + ".tmp"
    json.dump(s, open(tmp, "w")); os.replace(tmp, STATE)


def link(v): return "%s/#/network/signing" % SITE if NET == "mainnet" else None


def step(state, snap, quiet=False):
    """compare this snapshot with the samples kept; return the events it raises"""
    ev, now, H, W = [], snap["t"], snap["h"], snap["window"]
    crit_at = int(W * CRIT_FRACTION)
    samples = [s for s in state["samples"] if now - s["t"] <= KEEP_S]
    # the sample closest to DOWN_BLOCKS ago (at least that far back)
    base = None
    for s in samples:
        if H - s["h"] >= DOWN_BLOCKS: base = s
    recent = None
    for s in samples:
        if H - s["h"] >= 50: recent = s
    # only the active set is watched; a jailing or tombstoning is news only for a validator
    # that was active a sample ago (hundreds of long-dead ones stay jailed for ever)
    was = set(state.get("active") or [])
    first = not state["samples"]
    for cons, v in snap["vals"].items():
        if not v["bonded"] and cons not in was: continue
        m = snap["miss"].get(cons)
        if m is None: continue
        inc = state["inc"].setdefault(cons, {})
        name = v["m"] or cons[-8:]
        # down: nearly every block since DOWN_BLOCKS ago missed
        if v["bonded"] and base and cons in base["miss"]:
            dh, dm = H - base["h"], m - base["miss"][cons]
            if dm >= 0 and dh >= DOWN_BLOCKS and dm >= DOWN_SHARE * dh and not inc.get("down"):
                inc["down"] = {"since_h": base["h"], "since_t": base["t"]}
                ev.append(("warn", "Validator down: %s" % name,
                           "Missed %d of the last %d blocks (about %d minutes)." % (dm, dh, (now - base["t"]) // 60),
                           {"Missed in window": "%s of %s" % (f"{m:,}", f"{W:,}"), "Jailed at": f"{int(W * 0.95):,}", "Operator": v["op"][-10:]}, v))
        # back: signing again over the last 50+ blocks
        if inc.get("down") and recent and cons in recent["miss"]:
            dh, dm = H - recent["h"], m - recent["miss"][cons]
            if dh >= 50 and 0 <= dm <= 2:
                mins = (now - inc["down"]["since_t"]) // 60
                ev.append(("ok", "Validator signing again: %s" % name, "Back after about %d minutes." % mins,
                           {"Missed in window": "%s of %s" % (f"{m:,}", f"{W:,}")}, v))
                inc.pop("down", None)
        # critical: half the window missed
        if m >= crit_at and not inc.get("crit"):
            inc["crit"] = now
            ev.append(("crit", "CRITICAL: %s has missed %s blocks" % (name, f"{m:,}"),
                       "That is %d%% of the %s-block window. Jailing comes at %s missed." % (m * 100 // W, f"{W:,}", f"{int(W * 0.95):,}"),
                       {"Missed": f"{m:,}", "Window": f"{W:,}", "Operator": v["op"][-10:]}, v))
        elif m < crit_at * 0.8 and inc.get("crit"):
            inc.pop("crit", None)
            ev.append(("ok", "%s is out of the critical zone" % name, "Missed %s of %s." % (f"{m:,}", f"{W:,}"), None, v))
        # jailed / tombstoned: once per incident
        if v["jailed"] and not inc.get("jailed"):
            inc["jailed"] = now
            ev.append(("crit", "Validator jailed: %s" % name, "It no longer signs or earns until it unjails.", {"Operator": v["op"][-10:]}, v))
        elif not v["jailed"] and inc.get("jailed") and v["bonded"]:
            inc.pop("jailed", None)
            ev.append(("ok", "Validator unjailed: %s" % name, "", None, v))
        if snap["tomb"].get(cons) and not inc.get("tomb"):
            inc["tomb"] = now
            ev.append(("crit", "Validator tombstoned: %s" % name, "Permanently removed after a double sign.", {"Operator": v["op"][-10:]}, v))
        if not inc: state["inc"].pop(cons, None)
    active = [c for c, v in snap["vals"].items() if v["bonded"]]
    samples.append({"t": now, "h": H, "miss": {c: snap["miss"][c] for c in active if c in snap["miss"]}})
    state["samples"] = samples
    state["active"] = active
    # a fresh start records what already stands (incidents set above) without reporting it
    return [] if first else ev


def main():
    if "--test" in sys.argv:
        ok = notify.send("info", "AtomOne watch is connected", "Alerts for validator downtime, the critical zone, jailings, and Autopilot grants will arrive here.",
                         {"Down after": "%d blocks (~30 min)" % DOWN_BLOCKS, "Critical at": "%d%% of the window" % int(CRIT_FRACTION * 100)}, net=NET)
        print("sent" if ok else "NOT sent"); return
    state = load()
    if "--once" in sys.argv:
        snap = snapshot()
        for e in step(state, snap): print(e[0], e[1], "|", e[2])
        W = snap["window"]
        top = sorted(((snap["miss"].get(c, 0), v["m"]) for c, v in snap["vals"].items() if v["bonded"]), reverse=True)[:5]
        print("height", snap["h"], "window", W, "bonded", sum(1 for v in snap["vals"].values() if v["bonded"]), "most missed", top)
        return
    fails = 0
    while True:
        t0 = time.time()
        try:
            snap = snapshot()
            for level, title, text, fields, v in step(state, snap):
                log(level, title)
                notify.send(level, title, text, fields, link(v), net=NET)
            if state.get("api_down"):
                notify.send("ok", "Validator watch reads the chain again", "", net=NET); state["api_down"] = 0
            save(state); fails = 0
        except Exception as e:
            fails += 1
            log("read failed: %s" % e)
            if fails == 10 and not state.get("api_down"):
                state["api_down"] = int(time.time()); save(state)
                notify.send("warn", "Validator watch cannot read the chain", "Ten reads in a row failed: %s" % str(e)[:300], net=NET)
        time.sleep(max(5, EVERY - (time.time() - t0)))


if __name__ == "__main__":
    main()
