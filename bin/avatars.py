#!/usr/bin/env python3
"""
Resolve validator Keybase identities to avatars and cache them on disk.

WHY CACHED, NOT FETCHED BY THE BROWSER. Hot-linking Keybase would put 100 third-party
requests on every visitor, leak the reader to another host, and break the page's
"no external requests" property. And WHY PERSISTENT, not per-run: the page rebuilds
every 15 minutes: re-fetching 100 avatars 96 times a day would be abuse. Only
identities with no cached file are fetched, so a steady state costs zero requests.
"""
import re, json, os, ssl, sys, time, urllib.request
import urllib.parse
# a Keybase username or a 16-hex PGP key suffix - nothing that can traverse
SAFE_ID = re.compile(r"[A-Za-z0-9_.-]{1,32}")

CACHE = "/srv/atomone-app/state/avatars"
INDEX = os.path.join(CACHE, "index.json")
UA    = "gata-atomone-app/1.0 (+https://atomone.gatahub.zone/)"
MAXB  = 120_000          # skip anything implausibly large for a 40px tile


TILE = 64            # 2x a ~32px box, so it stays crisp on retina

def shrink(path):
    """Downscale in place. Keybase serves ~35 KB originals; 96 of those is 3.4 MB
    shipped to every visitor to draw 32px tiles. Fails soft: an unreadable image is
    simply dropped, because a missing avatar is cosmetic and must never break a build."""
    try:
        from PIL import Image
        im = Image.open(path)
        im = im.convert("RGB")
        im.thumbnail((TILE, TILE), Image.LANCZOS)
        im.save(path, "JPEG", quality=78, optimize=True)
    except Exception:
        try: os.remove(path)
        except Exception: pass

def load():
    try:    return json.load(open(INDEX))
    except Exception: return {}

def fetch_json(url):
    r = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(r, timeout=25) as f:
        return json.loads(f.read())

def resolve(identities, idx):
    """Look up only identities we have never resolved.

    ONE AT A TIME, deliberately. The plural `key_suffixes` parameter looks like it
    should batch but answers MISSING_PARAMETER - only singular `key_suffix` works.
    That is precisely why the cache is persistent: ~96 requests once, none after.
    """
    # The identity is whatever the operator typed into their validator
    # description. It becomes a cache filename and a query parameter below, so
    # anything that is not a plain Keybase handle or key suffix is dropped here
    # rather than sanitised further down - one gate, at the entrance.
    todo = [i for i in identities if i not in idx and SAFE_ID.fullmatch(i or "")]
    for n, key in enumerate(todo):
        # Two kinds of identity live in that field. A 16-character hex string is a
        # PGP key suffix; anything else validators put there is a Keybase
        # USERNAME, which needs a different parameter. Treating every identity as
        # a key suffix silently lost the avatar for everyone who wrote their
        # handle instead - Xilodyne among them.
        param = "key_suffix" if re.fullmatch(r"[0-9a-fA-F]{16}", key) else "username"
        try:
            d = fetch_json("https://keybase.io/_/api/1.0/user/lookup.json"
                           "?" + param + "=" + urllib.parse.quote(key, safe="")
                           + "&fields=pictures")
            them = d.get("them")
            entry = (them[0] if isinstance(them, list) and them else them) or {}
            url = ((entry.get("pictures") or {}).get("primary") or {}).get("url")
            idx[key] = url or ""          # "" = resolved, has no picture. Do not retry.
        except Exception as e:
            print(f"  lookup {key} failed: {e}", file=sys.stderr)
        time.sleep(0.35)                   # be a good citizen; this only runs on misses
    return idx

def download(idx):
    got = 0
    for key, url in idx.items():
        if not url or not SAFE_ID.fullmatch(key): continue
        # the picture URL is Keybase's own (their S3 bucket): anything else is not fetched, so
        # a profile can never point this collector at an address of its choosing
        if not re.match(r"^https://(s3\.amazonaws\.com/keybase_processed_uploads/|keybase\.io/)", url): continue
        dst = os.path.join(CACHE, key + ".jpg")
        if os.path.exists(dst) and os.path.getsize(dst) > 0: continue
        try:
            r = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(r, timeout=25) as f:
                blob = f.read(MAXB + 1)
            if len(blob) > MAXB or not blob:
                continue
            tmp = dst + ".tmp"
            open(tmp, "wb").write(blob)
            shrink(tmp)                    # 35 KB originals -> ~3 KB tiles
            os.replace(tmp, dst)
            got += 1
        except Exception:
            continue                       # a missing avatar is cosmetic, never fatal
    return got

if __name__ == "__main__":
    os.makedirs(CACHE, exist_ok=True)
    ids = [l.strip() for l in sys.stdin if l.strip()]
    idx = resolve(ids, load())
    json.dump(idx, open(INDEX, "w"))
    n = download(idx)
    have = sum(1 for k, v in idx.items() if v and os.path.exists(os.path.join(CACHE, k + ".jpg")))
    print(f"avatars: {len(idx)} resolved, {n} newly downloaded, {have} cached")
