#!/usr/bin/env python3
"""adminapi: the operator console's backend - loopback only, behind nginx at /admin-api/.

Sign-in is a Keplr signArbitrary (ADR-36) of a one-time challenge, signed on the network the
console is switched to: this service rebuilds the sign document, checks the secp256k1 signature
against the public key, derives the address from that key, and admits it only if it is an
operator on some network. Operators are listed per network - ADMIN_ADDRESSES_MAINNET and
ADMIN_ADDRESSES_TESTNET (ADMIN_ADDRESSES, the older single list, counts for mainnet when the
mainnet list is unset) - and every read and action checks the list of the network it is for. Nothing is sent on chain. A
session is an HMAC-signed cookie (12 hours, HttpOnly, Secure, SameSite=Strict, path
/admin-api) keyed by STATE_DIR/admin-secret (created 0600 on first start).

    GET  /admin-api/challenge               -> {text}           a message to sign, valid 5 min
    POST /admin-api/login {address, pubkey, signature, text}    -> sets the session cookie
    POST /admin-api/logout
    GET  /admin-api/me                       -> {address}
    GET  /admin-api/overview?net=mainnet|testnet               -> grants ledger, keeper status,
                                                                  validator incidents, events
    POST /admin-api/decide {net, granter, action, note?}      -> the operator's decision on a delegator:
         hold    Disable: Autopilot and Restake stop for this delegator (a note says why)
         resume  Enable: lift a hold

Every POST must be application/json and, when the browser sends an Origin, come from this host
(audit 2026-09-30). Every sign-in and every action is announced on Discord; refused sign-ins at most
once per wallet per hour and once per 10 minutes in all, from a background thread. Holds, decisions
and notes live in STATE_DIR/admin-<net>.json; the keeper reads it and skips a held delegator."""
import base64, hashlib, hmac, json, os, secrets, sys, threading, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import notify
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.exceptions import InvalidSignature

BIND, PORT = os.environ.get("ADMIN_BIND", "127.0.0.1"), int(os.environ.get("ADMIN_PORT", "8790"))
STATE_DIR = os.environ.get("STATE_DIR", "/srv/atomone-app/state")
WEB = {"mainnet": os.environ.get("WEB_MAINNET", "/srv/atomone-app/web"), "testnet": os.environ.get("WEB_TESTNET", "/srv/atomone-app/web/testnet")}
def _list(v): return {a.strip() for a in (v or "").split(",") if a.strip()}
ADMINS_BY = {"mainnet": _list(os.environ.get("ADMIN_ADDRESSES_MAINNET") or os.environ.get("ADMIN_ADDRESSES")),
             "testnet": _list(os.environ.get("ADMIN_ADDRESSES_TESTNET"))}
ADMINS = ADMINS_BY["mainnet"] | ADMINS_BY["testnet"]
def nets_of(a): return [n for n in ("mainnet", "testnet") if a in ADMINS_BY[n]]
SESSION_S = 12 * 3600
LOCK = threading.Lock()
CHALLENGES = {}          # nonce -> (expiry, the full text issued): login must sign exactly that text (audit 2026-09-30)
REVOKED = {}             # session token -> its expiry: logged out, refused until it would have expired anyway
REFUSED_AT = {}          # wallet -> when its refused sign-in was last announced
REFUSED = {"at": 0.0, "held": 0}   # the last refused-sign-in alert, and refusals not announced since
REFUSE_WALLET_S, REFUSE_ALL_S = 3600, 600


def log(*a): print("adminapi:", *a, flush=True)


def secret():
    p = os.path.join(STATE_DIR, "admin-secret")
    if not os.path.exists(p):
        fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.write(fd, secrets.token_bytes(32)); os.close(fd)
    return open(p, "rb").read()
KEY = secret()


# ── ADR-36: the sign document Keplr's signArbitrary signs ────────────────────
def sign_doc(signer, data):
    doc = {"account_number": "0", "chain_id": "", "fee": {"amount": [], "gas": "0"}, "memo": "",
           "msgs": [{"type": "sign/MsgSignData", "value": {"data": base64.b64encode(data.encode()).decode(), "signer": signer}}],
           "sequence": "0"}
    return json.dumps(doc, sort_keys=True, separators=(",", ":")).encode()


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
def bech32_decode(s):
    """-> (hrp, data bytes), or None unless the checksum holds and the padding is clean (audit 2026-09-30)"""
    if not isinstance(s, str) or s != s.lower() or len(s) > 90: return None
    hrp, sep, rest = s.rpartition("1")
    if not sep or not hrp or len(rest) < 6 or any(c not in CS for c in rest) or any(not 33 <= ord(c) <= 126 for c in hrp): return None
    d = [CS.index(c) for c in rest]
    if _polymod([ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp] + d) != 1: return None
    acc = bits = 0; out = []
    for v in d[:-6]:
        acc = (acc << 5) | v; bits += 5
        if bits >= 8: bits -= 8; out.append((acc >> bits) & 255)
    if bits >= 5 or acc & ((1 << bits) - 1): return None
    return hrp, bytes(out)
def is_account(a):
    d = bech32_decode(a)
    return bool(d) and d[0] == "atone" and len(d[1]) == 20


def verify(address, pubkey_b64, sig_b64, text):
    pk = base64.b64decode(pubkey_b64, validate=True)
    if len(pk) != 33: return False          # a compressed secp256k1 key, nothing else (audit 2026-09-30)
    derived = bech32("atone", hashlib.new("ripemd160", hashlib.sha256(pk).digest()).digest())
    if derived != address: return False
    sig = base64.b64decode(sig_b64, validate=True)
    if len(sig) != 64: return False
    key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pk)
    try:
        key.verify(encode_dss_signature(int.from_bytes(sig[:32], "big"), int.from_bytes(sig[32:], "big")),
                   sign_doc(address, text), ec.ECDSA(hashes.SHA256()))
        return True
    except InvalidSignature:
        return False


def token(address):
    # n: two sign-ins in one second still get two tokens, so a logout revokes only its own
    body = base64.urlsafe_b64encode(json.dumps({"a": address, "e": int(time.time()) + SESSION_S, "n": secrets.token_hex(8)}).encode()).decode()
    return body + "." + hmac.new(KEY, body.encode(), hashlib.sha256).hexdigest()


def cookie_token(cookie):
    """-> (token, its payload) when the session cookie carries our MAC, else None"""
    for part in (cookie or "").split(";"):
        k, _, v = part.strip().partition("=")
        if k != "aa_s": continue
        body, _, mac = v.partition(".")
        if not hmac.compare_digest(mac, hmac.new(KEY, body.encode(), hashlib.sha256).hexdigest()): return None
        try: d = json.loads(base64.urlsafe_b64decode(body.encode()))
        except Exception: return None
        return (v, d) if isinstance(d, dict) else None
    return None


def session(cookie):
    t = cookie_token(cookie)
    if not t: return None
    v, d = t
    if not isinstance(d.get("e"), (int, float)) or d["e"] < time.time() or d.get("a") not in ADMINS: return None
    with LOCK:
        if v in REVOKED: return None
    return d["a"]


def revoke(cookie):
    """logout: the token stops working here and now, not only in this browser (audit 2026-09-30; in memory, a restart forgets)"""
    t = cookie_token(cookie)
    if not t: return
    now = time.time()
    with LOCK:
        for k in [k for k, e in REVOKED.items() if e < now]: REVOKED.pop(k, None)
        e = t[1].get("e")
        if isinstance(e, (int, float)) and e >= now: REVOKED[t[0]] = e


def refused(addr):
    """a non-operator wallet signed a valid challenge: announce it at most once per wallet per hour and once
    per 10 minutes in all, counting what was held back, from a thread so the request never waits on Discord"""
    now = time.time()
    with LOCK:
        for k in [k for k, t in REFUSED_AT.items() if t < now - REFUSE_WALLET_S]: REFUSED_AT.pop(k, None)
        if addr in REFUSED_AT or now - REFUSED["at"] < REFUSE_ALL_S:
            REFUSED["held"] += 1; return
        held = REFUSED["held"]
        REFUSED_AT[addr] = now; REFUSED.update(at=now, held=0)
    text = "A wallet that is not an operator tried to sign in."
    if held: text += " %d more refused sign-in%s since the last alert (not announced one by one)." % (held, "" if held == 1 else "s")
    threading.Thread(target=notify.send, args=("warn", "Admin sign-in refused", text, {"Wallet": addr}), daemon=True).start()


def jload(p, default):
    try: return json.load(open(p))
    except Exception: return default


def admin_file(net): return os.path.join(STATE_DIR, "admin-%s.json" % net)


def adm_load(net):
    a = jload(admin_file(net), {})
    for k in ("paused", "notes", "approved", "decisions"): a.setdefault(k, {})
    return a


def adm_save(net, a):
    tmp = admin_file(net) + ".tmp"; json.dump(a, open(tmp, "w")); os.replace(tmp, admin_file(net))


def short(a): return a[:12] + "\u2026" + a[-6:]


def overview(net):
    led = jload(os.path.join(STATE_DIR, "grants-%s.json" % net), {})
    adm = adm_load(net)
    for g, e in (led.get("grants") or {}).items():
        e["paused"] = g in adm.get("paused", {})
        e["notes"] = adm.get("notes", {}).get(g, [])
        rep = jload(os.path.join(WEB[net], "keeper", g + ".json"), None)
        if rep: e["report"] = {k: rep.get(k) for k in ("checked", "staked", "now", "after", "gain", "moves", "history", "record", "restake", "last", "admin", "dry")}
    # validator names for the plans (the page's own data)
    D = jload(os.path.join(WEB[net], "data.json"), {})
    names = {v.get("op"): v.get("m") for v in D.get("validators", []) + D.get("inactive", []) if v.get("op")}
    # the watch knows validators by consensus address: named here from the page's own data (active by hex, the rest by cons)
    cons = {bech32("atonevalcons", bytes.fromhex(v["chex"])): v.get("m") for v in D.get("validators", []) if v.get("chex")}
    cons.update({v["cons"]: v.get("m") for v in D.get("inactive", []) if v.get("cons")})
    vw = jload(os.path.join(STATE_DIR, "valwatch-%s.json" % net), {})
    inc = []
    for c, i in (vw.get("inc") or {}).items():
        inc.append({"cons": c, "name": cons.get(c), **{k: i.get(k) for k in ("down", "crit", "jailed", "tomb")}})
    return {"net": net, "ledger": led, "keeper": jload(os.path.join(WEB[net], "keeper", "_status.json"), None),
            "valwatch": {"checked": (vw.get("samples") or [{}])[-1].get("t"), "active": len(vw.get("active") or []), "incidents": inc},
            "admin": {"pauses": len(adm.get("paused", {}))}, "names": names}


class H(BaseHTTPRequestHandler):
    server_version = "adminapi"
    def log_message(self, *a): pass

    def reply(self, code, obj, cookie=None):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json"); self.send_header("cache-control", "no-store")
        if cookie is not None:
            self.send_header("set-cookie", "aa_s=%s; Path=/admin-api; HttpOnly; Secure; SameSite=Strict; Max-Age=%d" % (cookie, SESSION_S if cookie else 0))
        self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def body(self):
        n = int(self.headers.get("content-length") or 0)
        if n < 0 or n > 16384: raise ValueError("length")
        b = json.loads(self.rfile.read(n) or b"{}")
        if not isinstance(b, dict): raise ValueError("not an object")
        return b

    def who(self): return session(self.headers.get("cookie"))

    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/admin-api/challenge":
            n = secrets.token_hex(12)
            text = "Sign in to the GATA AtomOne admin console.\nNothing is sent on chain.\nNonce: %s\nIssued: %s" % (n, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
            with LOCK:
                now = time.time()
                for k in [k for k, v in CHALLENGES.items() if v[0] < now]: CHALLENGES.pop(k, None)
                CHALLENGES[n] = (now + 300, text)
            return self.reply(200, {"text": text})
        a = self.who()
        if not a: return self.reply(401, {"error": "sign in"})
        if u.path == "/admin-api/me": return self.reply(200, {"address": a, "nets": nets_of(a)})
        if u.path == "/admin-api/overview":
            net = (q.get("net") or ["mainnet"])[0]
            if net not in WEB: return self.reply(400, {"error": "net"})
            if a not in ADMINS_BY[net]: return self.reply(403, {"error": "this wallet is not an operator on " + net})
            return self.reply(200, overview(net))
        return self.reply(404, {"error": "not found"})

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        # CSRF, beside SameSite=Strict (audit 2026-09-30): JSON only (a form or a no-cors fetch cannot send it),
        # and a browser's Origin must be this very host
        if (self.headers.get("content-type") or "").split(";")[0].strip().lower() != "application/json":
            return self.reply(415, {"error": "send application/json"})
        origin, host = self.headers.get("origin"), self.headers.get("host") or ""
        # the loopback test harness (http://127.0.0.1:8089) is the one plain-http origin allowed
        if origin is not None and origin != "https://" + host and not (host == "127.0.0.1:8089" and origin == "http://" + host):
            return self.reply(403, {"error": "origin"})
        try: b = self.body()
        except Exception: return self.reply(400, {"error": "bad body"})
        if u.path == "/admin-api/login":
            text, addr = str(b.get("text", "")), str(b.get("address", ""))
            n = text.split("Nonce: ")[-1].split("\n")[0] if "Nonce: " in text else ""
            with LOCK: exp, issued = CHALLENGES.pop(n, (0, None))
            # the nonce is spent either way; the signed text must be exactly the one issued (audit 2026-09-30)
            if exp < time.time() or text != issued: return self.reply(401, {"error": "the challenge expired or does not match, try again"})
            try: ok = verify(addr, str(b.get("pubkey", "")), str(b.get("signature", "")), text)
            except Exception: ok = False
            if not ok: return self.reply(401, {"error": "signature does not match"})
            if addr not in ADMINS:
                log("refused sign-in from %s" % addr)
                refused(addr)
                return self.reply(403, {"error": "this wallet is not an operator"})
            log("sign-in %s" % addr)
            notify.send("info", "Admin signed in", "", {"Operator": addr, "Networks": ", ".join(nets_of(addr))})
            return self.reply(200, {"address": addr}, cookie=token(addr))
        if u.path == "/admin-api/logout":
            revoke(self.headers.get("cookie"))
            return self.reply(200, {}, cookie="")
        a = self.who()
        if not a: return self.reply(401, {"error": "sign in"})
        net = str(b.get("net", "mainnet"))
        if net not in WEB: return self.reply(400, {"error": "net"})
        if a not in ADMINS_BY[net]: return self.reply(403, {"error": "this wallet is not an operator on " + net})
        if u.path == "/admin-api/decide":
            g, act, note = str(b.get("granter", "")), str(b.get("action", "")), str(b.get("note", "")).strip()[:500]
            if not is_account(g): return self.reply(400, {"error": "granter"})
            # no approvals since 2026-09-30: Autopilot carries out its plans itself; Hold and Resume are the operator's controls
            if act not in ("hold", "resume"): return self.reply(400, {"error": "action"})
            now = int(time.time())
            with LOCK:
                adm = adm_load(net)
                if act == "hold": adm["paused"][g] = {"by": a, "at": now}
                if act == "resume": adm["paused"].pop(g, None)
                adm["decisions"].setdefault(g, []).append({"action": act, "plan_id": None, "by": a, "at": now, "note": note})
                adm["decisions"][g] = adm["decisions"][g][-50:]
                if note: adm["notes"].setdefault(g, []).append({"by": a, "at": now, "text": note})
                adm_save(net, adm)
            log("decide %s %s %s by %s" % (net, g, act, a))
            if act == "hold":
                notify.send("warn", "Autopilot disabled: " + short(g), note or "Autopilot and Restake stop for this address until it is enabled.", {"Delegator": g, "Operator": a}, net=net)
            elif act == "resume":
                notify.send("info", "Autopilot enabled: " + short(g), "", {"Delegator": g, "Operator": a}, net=net)
            return self.reply(200, {"ok": True})
        return self.reply(404, {"error": "not found"})


if __name__ == "__main__":
    if not ADMINS: log("no ADMIN_ADDRESSES: nobody can sign in")
    log("listening on %s:%d, operators: %d mainnet, %d testnet" % (BIND, PORT, len(ADMINS_BY["mainnet"]), len(ADMINS_BY["testnet"])))
    ThreadingHTTPServer((BIND, PORT), H).serve_forever()
