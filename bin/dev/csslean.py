"""csslean: prune the AtomOne app's main stylesheet without changing what renders.

Three removals, each provably inert:
  1. dead selectors  - a selector naming a class or id (outside any parentheses) that no
                       markup, script or generator can ever produce matches nothing;
  2. overridden decls - an earlier declaration of a property in a rule whose selector text is
                       identical to a later rule's, in the same context (or the later one at
                       top level), with the later value one every browser understands, can
                       never win the cascade;
  3. unused keyframes - @keyframes no animation names.
Rules left empty, and @media blocks left empty, go too. Comments stay where they were,
except a comment that sat directly above a rule removed whole (kept - harmless).

usage: python3 dev/csslean.py page.tpl OUT.tpl [--report]   (from bin/; prove the result with dev/fp - see the handbook)
"""
import re, sys, json, os

SRC, OUT = sys.argv[1], sys.argv[2]
REPORT = "--report" in sys.argv
BIN = os.path.dirname(os.path.abspath(SRC))

tpl = open(SRC, encoding="utf-8").read()
m = re.search(r"<style>(.*?)</style>", tpl, re.S)
CSS_START, CSS_END = m.start(1), m.end(1)
css = m.group(1)

# ── known tokens: every word any markup, script or generator can put in a class or an id ──
markup = tpl[:m.start()] + tpl[m.end():]
srcs = [markup]
for f in ["app.js", "simple.js", "shell.js", "boot.js", "tx.js", "render.py", "shellgen.py", "shell.json", "constitution.py"]:
    p = os.path.join(BIN, f)
    if os.path.exists(p): srcs.append(open(p, encoding="utf-8").read())
KNOWN = set()
for s in srcs:
    KNOWN.update(re.findall(r"[A-Za-z_][A-Za-z0-9_-]*", s))

# class names a script builds by concatenation ("x-" + something) cannot be known word by word:
# any selector token with such a prefix is treated as live
PREFIXES = set()
for s in srcs[1:]:
    for q in re.findall(r"""["']([a-z][a-z0-9]*-)["']\s*\+""", s): PREFIXES.add(q)
    for q in re.findall(r"""["'][^"']*\s([a-z][a-z0-9]*-)["']\s*\+""", s): PREFIXES.add(q)

def known(tok):
    return tok in KNOWN or any(tok.startswith(p) for p in PREFIXES)

# ── a small parser that keeps character positions ──
def skip_ws_comments(i, text):
    n = len(text)
    while i < n:
        if text[i].isspace(): i += 1
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2); i = n if j < 0 else j + 2
        else: break
    return i

def find_block_end(text, i):
    """i at '{'; returns index just past the matching '}' (strings and comments respected)"""
    depth, n = 0, len(text)
    while i < n:
        c = text[i]
        if text.startswith("/*", i):
            j = text.find("*/", i + 2); i = n if j < 0 else j + 2; continue
        if c in "\"'":
            q = c; i += 1
            while i < n and text[i] != q:
                if text[i] == "\\": i += 1
                i += 1
            i += 1; continue
        if c == "{": depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0: return i + 1
        i += 1
    raise SystemExit("unbalanced braces")

def strip_comments(s):
    return re.sub(r"/\*.*?\*/", "", s, flags=re.S)

def parse_decls(text, start, end):
    """declarations inside [start,end) (the braces' interior) -> list of dicts with spans"""
    out, i = [], start
    while i < end:
        i = skip_ws_comments(i, text)
        if i >= end: break
        # a declaration runs to the next ';' at depth 0 (parens, strings) or the block end
        j, depth = i, 0
        while j < end:
            c = text[j]
            if text.startswith("/*", j):
                k = text.find("*/", j + 2); j = end if k < 0 else k + 2; continue
            if c in "\"'":
                q = c; j += 1
                while j < end and text[j] != q:
                    if text[j] == "\\": j += 1
                    j += 1
                j += 1; continue
            if c == "(": depth += 1
            elif c == ")": depth -= 1
            elif c == ";" and depth == 0: break
            j += 1
        raw = text[i:j]
        dend = j + 1 if j < end and text[j] == ";" else j
        body = strip_comments(raw).strip()
        if ":" in body:
            prop, val = body.split(":", 1)
            prop = prop.strip().lower() if not prop.strip().startswith("--") else prop.strip()
            val = val.strip()
            imp = bool(re.search(r"!\s*important\s*$", val, re.I))
            out.append({"prop": prop, "val": val, "imp": imp, "s": i, "e": dend})
        i = dend
    return out

def split_selectors(sel):
    parts, depth, cur = [], 0, ""
    for c in sel:
        if c in "([": depth += 1
        elif c in ")]": depth -= 1
        if c == "," and depth == 0: parts.append(cur); cur = ""
        else: cur += c
    parts.append(cur)
    return [p.strip() for p in parts]

rules, keyframes, medias = [], [], []
def parse(text, start, end, ctx):
    i = start
    while True:
        i = skip_ws_comments(i, text)
        if i >= end: break
        if text[i] == "@":
            head_end = text.find("{", i)
            head = strip_comments(text[i:head_end]).strip()
            close = find_block_end(text, head_end)
            if head.startswith("@media") or head.startswith("@container"):
                # a container query is a context like a media query: its rules only compete with rules
                # of the same context (the context string carries the at-rule's name to keep them apart)
                medias.append({"s": i, "e": close, "head": head, "open": head_end})
                ctx2 = re.sub(r"\s+", " ", head[6:].strip()) if head.startswith("@media") else "container " + re.sub(r"\s+", " ", head[10:].strip())
                parse(text, head_end + 1, close - 1, ctx2)
            elif head.startswith("@keyframes"):
                keyframes.append({"s": i, "e": close, "name": head.split()[1]})
            else:
                raise SystemExit("unexpected at-rule: " + head[:40])
            i = close
            continue
        brace = text.find("{", i)
        sel = strip_comments(text[i:brace]).strip()
        close = find_block_end(text, brace)
        rules.append({"s": i, "e": close, "sel": re.sub(r"\s+", " ", sel), "ctx": ctx,
                      "decls": parse_decls(text, brace + 1, close - 1), "selspan": (i, brace)})
        i = close

parse(css, 0, len(css), "")

# ── 1. dead selectors ──
def tokens_outside_parens(sel):
    out, depth, buf = [], 0, ""
    for c in sel:
        if c in "([": depth += 1; buf += " "; continue
        if c in ")]": depth -= 1; buf += " "; continue
        buf += c if depth == 0 else " "
    return re.findall(r"([.#])([A-Za-z_][A-Za-z0-9_-]*)", buf)

dead_sel = {}      # rule index -> list of dead selector strings
for k, r in enumerate(rules):
    sels = split_selectors(r["sel"])
    dead = [s for s in sels if any(not known(t) for _, t in tokens_outside_parens(s))]
    if dead: dead_sel[k] = (sels, dead)

# ── 2. overridden declarations ──
# the day theme is a generated shadow of these rules (bin/dev/daygen.py): a night declaration
# with a colour gets a day copy under a stronger selector. An overridden night declaration may
# only go if its day copy is overridden too - it has none, or the later one has one of its own
import importlib.util
_spec = importlib.util.spec_from_file_location("daygen", os.path.join(BIN, "dev", "daygen.py"))
DG = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(DG)
def shadows(d):
    try: return DG.transform_decl(d["prop"], re.sub(r"!\s*important\s*$", "", d["val"], flags=re.I).strip(), d["imp"]) is not None
    except Exception: return True
MODERN = re.compile(r"\b\d*\.?\d+(svh|dvh|lvh|svw|dvw|lvw|cqw|cqh|cqi|cqb|cqmin|cqmax)\b|clamp\(|\bmin\(|\bmax\(|color-mix\(|oklch\(|oklab\(|\blch\(|\blab\(|light-dark\(", re.I)
def universal(vals):
    return any(not MODERN.search(v) for v in vals)

by_sel = {}
for k, r in enumerate(rules):
    by_sel.setdefault(r["sel"], []).append(k)
over = set()       # (rule index, decl index)
for sel, ks in by_sel.items():
    if len(ks) < 2: continue
    for a_i, a in enumerate(ks):
        ra = rules[a]
        for di, d in enumerate(ra["decls"]):
            for b in ks[a_i + 1:]:
                rb = rules[b]
                if not (rb["ctx"] == ra["ctx"] or rb["ctx"] == ""): continue
                later = [x for x in rb["decls"] if x["prop"] == d["prop"]]
                if not later: continue
                if d["imp"] and not any(x["imp"] for x in later): continue
                if not universal([x["val"] for x in later]): continue
                if shadows(d) and not any(shadows(x) for x in later): continue
                over.add((a, di)); break

# ── 3. unused keyframes ──
day = open(os.path.join(BIN, "assets", "theme-day.css"), encoding="utf-8").read() if os.path.exists(os.path.join(BIN, "assets", "theme-day.css")) else ""
hand = open(os.path.join(BIN, "dev", "theme-day.hand.css"), encoding="utf-8").read()
anim_text = " ".join(d["val"] for r in rules for d in r["decls"] if d["prop"] in ("animation", "animation-name")) + " " + day + " " + hand + " " + " ".join(srcs[1:])
dead_kf = [kf for kf in keyframes if not re.search(r"(?<![A-Za-z0-9_-])" + re.escape(kf["name"]) + r"(?![A-Za-z0-9_-])", anim_text)]

# ── the edits, as character spans over css ──
edits = []   # (start, end, replacement)
removed_rules = set()
for k, r in enumerate(rules):
    decls_left = [di for di in range(len(r["decls"])) if (k, di) not in over]
    sels_info = dead_sel.get(k)
    live_sels = None
    if sels_info:
        sels, dead = sels_info
        live_sels = [s for s in sels if s not in dead]
    if (live_sels is not None and not live_sels) or (r["decls"] and not decls_left):
        edits.append((r["s"], r["e"], "")); removed_rules.add(k); continue
    if live_sels is not None:
        a, b = r["selspan"]
        edits.append((a, b, ",".join(live_sels)))
    for di, d in enumerate(r["decls"]):
        if (k, di) in over: edits.append((d["s"], d["e"], ""))
for kf in dead_kf: edits.append((kf["s"], kf["e"], ""))

# a media block whose every rule goes, goes whole
for md in medias:
    inner = [k for k, r in enumerate(rules) if r["s"] > md["open"] and r["e"] <= md["e"]]
    if inner and all(k in removed_rules for k in inner):
        edits = [e for e in edits if not (e[0] >= md["s"] and e[1] <= md["e"])]
        edits.append((md["s"], md["e"], ""))

edits.sort(key=lambda e: e[0])
# drop edits nested inside another removal
clean, last_end = [], -1
for e in edits:
    if e[0] < last_end: continue
    clean.append(e); last_end = e[1]
out, pos = [], 0
for s, e, rep in clean:
    out.append(css[pos:s]); out.append(rep); pos = e
out.append(css[pos:])
new_css = "".join(out)
# tidy: runs of blank lines left by removals
new_css = re.sub(r"\n[ \t]*(?:\n[ \t]*){2,}", "\n\n", new_css)
# a declaration list that lost its last item keeps a dangling ';' - harmless; an empty '{}' is not left (rule removed)

open(OUT, "w", encoding="utf-8").write(tpl[:CSS_START] + new_css + tpl[CSS_END:])
stats = {"css_before": len(css.encode()), "css_after": len(new_css.encode()), "rules": len(rules),
         "rules_removed": len(removed_rules), "selectors_dropped": sum(len(v[1]) for v in dead_sel.values()),
         "decls_overridden": len(over), "keyframes_removed": [k["name"] for k in dead_kf], "prefixes": sorted(PREFIXES)}
print(json.dumps(stats))
if REPORT:
    for k, (sels, dead) in sorted(dead_sel.items()):
        for s in dead:
            print("DEAD", s, "  [unknown:", ",".join(t for _, t in tokens_outside_parens(s) if not known(t)) + "]")
