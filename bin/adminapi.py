#!/usr/bin/env python3
"""adminapi: the operator console's backend - loopback only, behind nginx at /admin-api/.

Sign-in is a Keplr signArbitrary (ADR-36) of a one-time challenge: this service rebuilds the
sign document, checks the secp256k1 signature against the public key, derives the address
from that key, and admits it only if it is in ADMIN_ADDRESSES. Nothing is sent on chain. A
session is an HMAC-signed cookie (12 hours, HttpOnly, Secure, SameSite=Strict, path
/admin-api) keyed by STATE_DIR/admin-secret (created 0600 on first start).

    GET  /admin-api/challenge               -> {text}           a message to sign, valid 5 min
    POST /admin-api/login {address, pubkey, signature, text}    -> sets the session cookie
    POST /admin-api/logout
    GET  /admin-api/me                       -> {address}
    GET  /admin-api/overview?net=mainnet|testnet               -> grants ledger, keeper status,
                                                                  validator incidents, events
    POST /admin-api/decide {net, granter, action, plan_id?, note?} -> the operator's decision on a delegator:
         apply   carry out exactly this plan (plan_id must be the keeper's current one)
         nomove  activate with no move: the stake already sits well
         hold    stop the clock and the keeper for this delegator (a note says why)
         resume  lift a hold
    POST /admin-api/pause {net, granter, paused}               -> the keeper skips / resumes it
    POST /admin-api/note  {net, granter, text}
    POST /admin-api/test-alert                                 -> one Discord message

Every sign-in and every action is announced on Discord. Pauses, approvals, decisions and notes live
in STATE_DIR/admin-<net>.json; the keeper reads it and executes only an approved plan."""
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
ADMINS = {a.strip() for a in os.environ.get("ADMIN_ADDRESSES", "").split(",") if a.strip()}
SESSION_S = 12 * 3600
LOCK = threading.Lock()
CHALLENGES = {}          # nonce -> expiry


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


def verify(address, pubkey_b64, sig_b64, text):
    pk = base64.b64decode(pubkey_b64)
    derived = bech32("atone", hashlib.new("ripemd160", hashlib.sha256(pk).digest()).digest())
    if derived != address: return False
    sig = base64.b64decode(sig_b64)
    if len(sig) != 64: return False
    key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pk)
    try:
        key.verify(encode_dss_signature(int.from_bytes(sig[:32], "big"), int.from_bytes(sig[32:], "big")),
                   sign_doc(address, text), ec.ECDSA(hashes.SHA256()))
        return True
    except InvalidSignature:
        return False


def token(address):
    body = base64.urlsafe_b64encode(json.dumps({"a": address, "e": int(time.time()) + SESSION_S}).encode()).decode()
    return body + "." + hmac.new(KEY, body.encode(), hashlib.sha256).hexdigest()


def session(cookie):
    for part in (cookie or "").split(";"):
        k, _, v = part.strip().partition("=")
        if k != "aa_s": continue
        body, _, mac = v.partition(".")
        if not hmac.compare_digest(mac, hmac.new(KEY, body.encode(), hashlib.sha256).hexdigest()): return None
        try: d = json.loads(base64.urlsafe_b64decode(body.encode()))
        except Exception: return None
        if d.get("e", 0) < time.time() or d.get("a") not in ADMINS: return None
        return d["a"]
    return None


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
    names = {v.get("op"): v.get("m") for v in D.get("validators", []) if v.get("op")}
    vw = jload(os.path.join(STATE_DIR, "valwatch-%s.json" % net), {})
    inc = []
    for c, i in (vw.get("inc") or {}).items():
        inc.append({"cons": c, **{k: i.get(k) for k in ("down", "crit", "jailed", "tomb")}})
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
        if n > 16384: raise ValueError("too large")
        return json.loads(self.rfile.read(n) or b"{}")

    def who(self): return session(self.headers.get("cookie"))

    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/admin-api/challenge":
            n = secrets.token_hex(12)
            with LOCK:
                now = time.time()
                for k in [k for k, v in CHALLENGES.items() if v < now]: CHALLENGES.pop(k, None)
                CHALLENGES[n] = now + 300
            return self.reply(200, {"text": "Sign in to the GATA AtomOne admin console.\nNothing is sent on chain.\nNonce: %s\nIssued: %s" % (n, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))})
        a = self.who()
        if not a: return self.reply(401, {"error": "sign in"})
        if u.path == "/admin-api/me": return self.reply(200, {"address": a})
        if u.path == "/admin-api/overview":
            net = (q.get("net") or ["mainnet"])[0]
            if net not in WEB: return self.reply(400, {"error": "net"})
            return self.reply(200, overview(net))
        return self.reply(404, {"error": "not found"})

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        try: b = self.body()
        except Exception: return self.reply(400, {"error": "bad body"})
        if u.path == "/admin-api/login":
            text, addr = str(b.get("text", "")), str(b.get("address", ""))
            n = text.split("Nonce: ")[-1].split("\n")[0] if "Nonce: " in text else ""
            with LOCK: exp = CHALLENGES.pop(n, 0)
            if exp < time.time(): return self.reply(401, {"error": "the challenge expired, try again"})
            try: ok = verify(addr, b.get("pubkey", ""), b.get("signature", ""), text)
            except Exception: ok = False
            if not ok: return self.reply(401, {"error": "signature does not match"})
            if addr not in ADMINS:
                log("refused sign-in from %s" % addr)
                notify.send("warn", "Admin sign-in refused", "A wallet that is not an operator tried to sign in.", {"Wallet": addr})
                return self.reply(403, {"error": "this wallet is not an operator"})
            log("sign-in %s" % addr)
            notify.send("info", "Admin signed in", "", {"Operator": addr})
            return self.reply(200, {"address": addr}, cookie=token(addr))
        if u.path == "/admin-api/logout": return self.reply(200, {}, cookie="")
        a = self.who()
        if not a: return self.reply(401, {"error": "sign in"})
        net = b.get("net", "mainnet")
        if net not in WEB: return self.reply(400, {"error": "net"})
        if u.path == "/admin-api/decide":
            g, act, note = str(b.get("granter", "")), str(b.get("action", "")), str(b.get("note", "")).strip()[:500]
            if not (g.startswith("atone1") and len(g) == 44): return self.reply(400, {"error": "granter"})
            if act not in ("apply", "nomove", "hold", "resume"): return self.reply(400, {"error": "action"})
            if act == "hold" and not note: return self.reply(400, {"error": "a hold needs a note: why"})
            rep = jload(os.path.join(WEB[net], "keeper", g + ".json"), {}) or {}
            cur = (rep.get("admin") or {}).get("plan_id")
            pid = b.get("plan_id") or None
            if act == "apply":
                if not cur or not rep.get("moves"): return self.reply(409, {"error": "there is no plan to apply: use No move needed"})
                if pid != cur: return self.reply(409, {"error": "the plan changed since you opened it: review the new one"})
            now = int(time.time())
            with LOCK:
                adm = adm_load(net)
                if act == "apply": adm["approved"][g] = {"plan_id": cur, "by": a, "at": now}
                if act == "nomove": adm["approved"].pop(g, None)
                if act == "hold": adm["paused"][g] = {"by": a, "at": now}
                if act == "resume": adm["paused"].pop(g, None)
                adm["decisions"].setdefault(g, []).append({"action": act, "plan_id": cur if act in ("apply", "nomove") else None, "by": a, "at": now, "note": note})
                adm["decisions"][g] = adm["decisions"][g][-50:]
                if note: adm["notes"].setdefault(g, []).append({"by": a, "at": now, "text": note})
                adm_save(net, adm)
            log("decide %s %s %s by %s" % (net, g, act, a))
            # apply is announced by the keeper once it is carried out ("strategy applied"); the rest here
            if act == "nomove":
                notify.send("ok", "Autopilot strategy applied: " + short(g), "No move needed: the stake already sits well. Confirmed by an operator.",
                            {"Delegator": g, "Operator": a}, net=net)
            elif act == "hold":
                notify.send("warn", "Autopilot on hold: " + short(g), note, {"Delegator": g, "Operator": a}, net=net)
            elif act == "resume":
                notify.send("info", "Autopilot resumed: " + short(g), "", {"Delegator": g, "Operator": a}, net=net)
            return self.reply(200, {"ok": True})
        if u.path in ("/admin-api/pause", "/admin-api/note"):
            g = str(b.get("granter", ""))
            if not (g.startswith("atone1") and len(g) == 44): return self.reply(400, {"error": "granter"})
            with LOCK:
                adm = adm_load(net)
                if u.path.endswith("pause"):
                    if b.get("paused"): adm.setdefault("paused", {})[g] = {"by": a, "at": int(time.time())}
                    else: adm.setdefault("paused", {}).pop(g, None)
                    what = "paused" if b.get("paused") else "resumed"
                else:
                    t = str(b.get("text", "")).strip()[:500]
                    if not t: return self.reply(400, {"error": "empty note"})
                    adm.setdefault("notes", {}).setdefault(g, []).append({"by": a, "at": int(time.time()), "text": t})
                    what = "noted"
                adm_save(net, adm)
            notify.send("info", "Autopilot %s by an operator" % what, (b.get("text") or "")[:300] if what == "noted" else "",
                        {"Delegator": g, "Operator": a}, net=net)
            return self.reply(200, {"ok": True})
        if u.path == "/admin-api/test-alert":
            ok = notify.send("info", "Test alert from the admin console", "", {"Operator": a}, net=net)
            return self.reply(200, {"sent": ok})
        return self.reply(404, {"error": "not found"})


if __name__ == "__main__":
    if not ADMINS: log("no ADMIN_ADDRESSES: nobody can sign in")
    log("listening on %s:%d, %d operator(s)" % (BIND, PORT, len(ADMINS)))
    ThreadingHTTPServer((BIND, PORT), H).serve_forever()
