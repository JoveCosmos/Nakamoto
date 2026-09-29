#!/usr/bin/env python3
"""
Build assets/theme-day.css - the DAY (light) theme - from the page's own stylesheet.

The page has one theme, night, written as ~4,000 lines of hand-set colour. Day is not
a second hand-written sheet: it is a SHADOW of the night sheet. Every rule that carries
a colour (or a gradient, a shadow, a scrollbar colour, a coloured custom property) is
copied here, scoped to the light preference and to the non-wireframe page, with each
night value swapped for a day token - grounds for ivory surfaces, inks for ink, the
greens/violets/blues for the one teal accent, amber for the warn pair, red for danger;
gradients flattened, glows and drop shadows removed. Because the copy carries the
original selector under a higher-specificity prefix and comes later in the cascade, it
wins wherever the original would have applied, so no night colour can bleed through.

On top of that shadow sits dev/theme-day.hand.css - the typography, radii, spacing and
component styling the day spec asks for - appended verbatim inside the same scope.

Run it after any change to page.tpl's stylesheet:  python3 dev/daygen.py
"""
import io, os, re, sys, colorsys

HERE = os.path.dirname(os.path.abspath(__file__))
BIN = os.path.dirname(HERE)
TPL = os.path.join(BIN, "page.tpl")
HAND = os.path.join(HERE, "theme-day.hand.css")
OUT = os.path.join(BIN, "assets", "theme-day.css")

SCOPE = "html[data-theme=light]:not([data-mono])"   # day is the reader's choice (boot.js stamps it). The wireframe theme is gone (2026-09-25); the :not() stays only because every shadow rule's specificity was tuned with it

# ── the tokens (the spec's, verbatim) ───────────────────────────────────────────────
TOKENS = """
--bg:#F4F1EA;--surface:#FFFDF8;--surface-2:#F8F6F0;--surface-sunk:#F4F1EA;--field:#FFFFFF;
--line:#E3DED3;--line-soft:#EEEAE1;--line-strong:#D8D2C5;
--ink:#17191C;--muted:#5E5A52;--faint:#8A857B;
--accent:#0E5E52;--accent-hover:#0A463D;--accent-soft:#EDF4F0;--accent-tint:#E3EEEA;
--warn:#9A5B0B;--warn-bg:#F7EEDD;--warn-ink:#7A4808;
--danger:#8E2F22;--danger-bg:#F6E3DF;--danger-bar:#A33A2B;
--amber-bar:#B7791F;--neutral-pill:#ECE9E2;
--overlay:rgba(23,25,28,0.38);--shadow-modal:0 30px 80px rgba(23,25,28,0.25);--shadow-toast:0 16px 40px rgba(23,25,28,0.25);
--track:#ECE8DF;
--day-display:"Fraunces",Georgia,"Times New Roman",serif;
--day-sans:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
--day-mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;
"""

# ── the night palette by role: exact matches first ──────────────────────────────────
GROUND_BG   = {"#070a10", "#06060c", "#000000", "#08080a", "#0a0a12"}
GROUND_SURF = {"#09090f", "#0b0b16", "#0b0b18", "#0a0a14", "#0e1622", "#0a1320", "#0a0a13", "#0b111b", "#0c0c1a", "#0b0b17"}
GROUND_RAIS = {"#0e0e1d", "#0f0f1c", "#12122a", "#17172f", "#121c2b", "#16162a", "#15152a", "#0e0e1c", "#151530",
               "#0f0f22", "#141430", "#0d0d20", "#1d1d36", "#191933", "#232345", "#1a1730", "#12101f", "#1f1a3a",
               "#14201a", "#0f1a14", "#171730", "#12121f", "#0f0f20", "#181c33", "#101327", "#262c4e", "#1a1f3a",
               "#13132a", "#111124", "#10101f", "#1b1b33", "#0d0d1a"}
LINE_SOFT   = {"#16162c", "#16162a", "#22223c", "#1b2738", "#1c1c33"}
LINE        = {"#232342", "#2b2b4a", "#2f2f52", "#27274a", "#2c3258"}
LINE_STRONG = {"#34345c", "#2a3c54", "#3a3a62", "#3a3a63", "#3e3e66", "#3a4170", "#3b426e", "#4a5290", "#5d66a8", "#3b4756"}
INK   = {"#e9eff7", "#e6e4f0", "#fff8dc", "#ffffff", "#f0eef8", "#fff4f1", "#f4f7fb", "#d9f7e4", "#eef2f8", "#f3f2fa"}
MUTED = {"#8595ab", "#a5a3c4", "#c1bfdc", "#9d9bc2", "#b5b5b5", "#c9c2ff", "#d6d1ff", "#bdbbd6"}
FAINT = {"#566679", "#6f6d94", "#4a4a68", "#66648c", "#8a88b0", "#7a789c", "#5c5a80"}
GREEN = {"#2ee06a", "#36d399", "#3cf07a", "#46f585", "#22c65e", "#5cf08f", "#8ef0c8", "#7cf0a4", "#4cf28a", "#22c65c", "#2f8f6b"}
VIOLET= {"#b9b0ff", "#6f66c8", "#cdc6ff", "#9f95f2", "#8f7bff", "#a99fff"}
BLUE  = {"#3b9eff", "#62d9ff", "#2bc8bd", "#8fe8e0", "#9ed6f7", "#2c76c9", "#04121f"}
AMBER = {"#ffb02e", "#ffb155", "#ffd58a", "#ffc453", "#f0a020", "#e69a1e"}
RED   = {"#ff4d1f", "#ff7a45", "#ff9b7a", "#ff8a5c", "#ff6a3d", "#f0521f", "#a8372c", "#8a2b22", "#9c2433", "#761b27",
         "#b5453a", "#ad2f3e", "#c43a4b", "#c9584c", "#e8552a"}
DARKTEXT = {"#03120a", "#062012", "#04170b", "#1a1000", "#14103a", "#2a0d05", "#1b1440", "#0a0a14"}

REPOINTED = {"--void","--edge","--edge2","--ink","--ink2","--ink3","--faint","--hot","--burn","--cold","--lit","--card","--card2","--inset",
             "--blue","--cyan","--green","--amber","--cv","--ce","--ce2","--ci","--ci2","--ci3","--cf","--ch","--cb","--cc","--cl","--mono","--sans",
             "--wc","--wh","--wbd","--wbd2","--wi","--wchip","--wt","--ws","--wf","--wblue","--wcyan","--wgreen","--wamber","--wburn","--wgold","--wsans","--wmono"}
TEXT_PROPS = {"color", "fill", "stroke", "caret-color", "-webkit-text-fill-color", "text-decoration-color", "column-rule-color"}

def hexnorm(h):
    h = h.lower()
    if len(h) == 4: h = "#" + "".join(c * 2 for c in h[1:])
    if len(h) == 5: h = "#" + "".join(c * 2 for c in h[1:4]) + h[4] * 2
    return h

def to_rgba(s):
    """'#rgb', '#rrggbb', '#rrggbbaa', rgb(), rgba() -> (r,g,b,a) or None"""
    s = s.strip().lower()
    if s.startswith("#"):
        h = hexnorm(s)
        if len(h) == 7: return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 1.0
        if len(h) == 9: return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), int(h[7:9], 16) / 255
        return None
    m = re.match(r"rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)", s)
    if m:
        a = m.group(4)
        if a is None: a = 1.0
        elif a.endswith("%"): a = float(a[:-1]) / 100
        else: a = float(a)
        return float(m.group(1)), float(m.group(2)), float(m.group(3)), a
    return None

def classify(rgba):
    """a night colour -> a day family: bg surface raised line-soft line line-strong ink muted faint
       green violet blue amber red darktext white-alpha black-alpha"""
    r, g, b, a = rgba
    key = "#%02x%02x%02x" % (int(round(r)), int(round(g)), int(round(b)))
    for fam, S in (("bg", GROUND_BG), ("surface", GROUND_SURF), ("raised", GROUND_RAIS), ("line-soft", LINE_SOFT), ("line", LINE),
                   ("line-strong", LINE_STRONG), ("ink", INK), ("muted", MUTED), ("faint", FAINT), ("green", GREEN),
                   ("violet", VIOLET), ("blue", BLUE), ("amber", AMBER), ("red", RED), ("darktext", DARKTEXT)):
        if key in S: return fam
    if (r, g, b) == (255, 255, 255): return "white-alpha" if a < 1 else "ink"
    if (r, g, b) == (0, 0, 0): return "black-alpha" if a < 1 else "bg"
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if s < 0.28:
        if l < 0.05: return "bg"
        if l < 0.09: return "surface"
        if l < 0.14: return "raised"
        if l < 0.2: return "line-soft"
        if l < 0.3: return "line"
        if l < 0.42: return "line-strong"
        if l < 0.55: return "faint"
        if l < 0.78: return "muted"
        return "ink"
    hd = h * 360
    if l < 0.16:
        return "raised" if s < 0.5 else "darktext"
    if 95 <= hd <= 175: return "green"
    if 175 < hd <= 215: return "blue"
    if 215 < hd <= 280: return "violet" if l > 0.35 else "raised"
    if 25 <= hd < 60: return "amber"
    if hd < 25 or hd >= 330: return "red"
    return "muted"

def day_token(fam, a, prop):
    """which day token a night colour becomes, given its family, alpha and the property"""
    text = prop in TEXT_PROPS
    soft = a < 0.32
    if fam == "bg": return "var(--ink)" if text else "var(--bg)"
    if fam == "surface": return "var(--ink)" if text else "var(--surface)"
    if fam == "raised": return "var(--ink)" if text else "var(--surface-2)"
    if fam == "line-soft": return "var(--faint)" if text else "var(--line-soft)"
    if fam == "line": return "var(--faint)" if text else "var(--line)"
    if fam == "line-strong": return "var(--faint)" if text else "var(--line-strong)"
    if fam == "ink": return "var(--ink)" if text else ("var(--surface-2)" if soft else "var(--accent)")
    if fam == "muted": return "var(--muted)" if text else ("var(--surface-2)" if soft else "var(--line-strong)")
    if fam == "faint": return "var(--faint)" if text else ("var(--surface-2)" if soft else "var(--line-strong)")
    if fam in ("green", "violet", "blue"): return "var(--accent)" if text or not soft else "var(--accent-soft)"
    if fam == "amber": return "var(--warn)" if text else ("var(--warn-bg)" if soft else "var(--amber-bar)")
    if fam == "red": return "var(--danger)" if text else ("var(--danger-bg)" if soft else "var(--danger-bar)")
    if fam == "darktext": return "#FFFFFF" if text else "var(--surface)"
    if fam == "white-alpha": return "var(--ink)" if text else ("transparent" if a < 0.12 else "rgba(23,25,28,%.2f)" % min(a, 0.5))
    if fam == "black-alpha": return "var(--ink)" if text else ("var(--overlay)" if a >= 0.3 else "transparent")
    return "var(--ink)"

COLOR_RE = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)")

def map_colours(value, prop):
    def rep(m):
        s = m.group(0)
        rgba = to_rgba(s)
        if rgba is None: return s
        return day_token(classify(rgba), rgba[3], prop)
    return COLOR_RE.sub(rep, value)

def split_top(s, sep=","):
    """split on sep outside parentheses and quotes"""
    out, depth, cur, q = [], 0, "", None
    for ch in s:
        if q:
            cur += ch
            if ch == q: q = None
            continue
        if ch in "\"'": q = ch; cur += ch; continue
        if ch == "(": depth += 1
        elif ch == ")": depth -= 1
        if ch == sep and depth == 0:
            out.append(cur); cur = ""
        else: cur += ch
    out.append(cur)
    return out

def first_token(s):
    """the first whitespace-separated token at bracket depth 0: 'color-mix(in srgb,x 5%,y) 30%'
       is one token, not 'color-mix(in' - splitting inside a bracket once left an unclosed '('
       that swallowed the rest of the day sheet"""
    d = 0
    for i, ch in enumerate(s.strip()):
        if ch == "(": d += 1
        elif ch == ")": d -= 1
        elif ch.isspace() and d == 0: return s.strip()[:i]
    return s.strip()

def flatten_layers(value, prop):
    """gradients become flat colours (or nothing, for highlight lines and glows)"""
    layers = split_top(value)
    out = []
    for L in layers:
        t = L.strip()
        if not t: continue
        low = t.lower()
        if low.startswith("radial-gradient(") or low.startswith("conic-gradient(") or low.startswith("repeating-"):
            continue                                       # a glow: gone
        if low.startswith("linear-gradient("):
            inner = t[t.index("(") + 1:-1]
            stops = [x.strip() for x in split_top(inner)]
            if stops and re.match(r"^(to |\d)", stops[0].lower()) or (stops and stops[0].lower().endswith("deg")):
                stops = stops[1:]
            stops = [x for x in stops if x]
            if any(x.lower().startswith("transparent") for x in stops):
                continue                                   # a highlight line: gone
            if not stops: continue
            first = first_token(stops[0])                  # "colour 30%" -> colour, color-mix(...) whole
            out.append(map_colours(first, prop) if COLOR_RE.search(first) else first)
            continue
        out.append(map_colours(t, prop))
    if not out:
        return "transparent" if prop in ("background", "background-image") else "none"
    return ",".join(out)

def map_shadow(value):
    """keep hairline rings (no blur, no offset), drop the rest"""
    keep = []
    for L in split_top(value):
        t = L.strip()
        if not t or t.lower() in ("none", "unset", "initial"): continue
        parts = split_top(t, " ")
        parts = [p for p in parts if p]
        nums = [p for p in parts if re.match(r"^-?[\d.]+(px|em|rem)?$", p)]
        inset = any(p == "inset" for p in parts)
        if len(nums) >= 3 and all(re.match(r"^-?0(px)?$", n) for n in nums[:3]) and (len(nums) < 5):
            keep.append(map_colours(t, "box-shadow"))    # a ring: x y blur spread all 0 but spread
        elif inset and len(nums) >= 4 and all(re.match(r"^-?0(px)?$", n) for n in nums[:3]):
            keep.append(map_colours(t, "box-shadow"))
    return ",".join(keep) if keep else "none"

COLOUR_PROPS = {"color", "background", "background-color", "background-image", "border", "border-color", "border-top", "border-right",
                "border-bottom", "border-left", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
                "outline", "outline-color", "box-shadow", "text-shadow", "fill", "stroke", "scrollbar-color", "caret-color",
                "accent-color", "filter", "backdrop-filter", "color-scheme", "text-decoration-color", "-webkit-text-fill-color",
                "column-rule", "column-rule-color", "border-block", "border-inline", "text-decoration"}

def transform_decl(prop, value, important):
    """a night declaration -> its day shadow, or None; a result whose brackets do not balance is
       dropped rather than emitted (one bad '(' invalidates everything after it)"""
    r = _transform_decl(prop, value, important)
    if r and r[1].count("(") != r[1].count(")"):
        print(f"daygen: dropped unbalanced {prop}: {r[1][:60]}", file=sys.stderr)
        return None
    return r

def _transform_decl(prop, value, important):
    """a night declaration -> its day shadow, or None to leave it alone"""
    p = prop.lower().strip()
    v = value.strip()
    if p.startswith("--"):
        if p in REPOINTED: return None                     # the night tokens are re-pointed wholesale below
        if COLOR_RE.search(v) and "gradient" not in v.lower():
            return p, map_colours(v, "color"), important   # --c, --acc and the like tint text and dashes
        return None
    if p not in COLOUR_PROPS: return None
    low = v.lower()
    if p == "color-scheme": return p, "light", important
    if p == "text-shadow": return p, "none", important
    if p == "box-shadow": return p, map_shadow(v), important
    if p in ("filter", "backdrop-filter"):
        if "drop-shadow" in low: return p, "none", important
        return None
    if p in ("background", "background-image"):
        if "gradient(" in low or COLOR_RE.search(v) or low in ("transparent", "none"):
            return p, flatten_layers(v, p), important
        return None
    if not (COLOR_RE.search(v) or low in ("transparent", "currentcolor", "none", "inherit")):
        return None
    if low in ("transparent", "currentcolor", "none", "inherit"): return p, v, important
    return p, map_colours(v, p), important

def scope_selector(sel):
    s = sel.strip()
    if not s: return s
    if s.startswith(":root"): return SCOPE + s[5:]
    if s.startswith("html"):
        return SCOPE + s[4:]
    return SCOPE + " " + s

def parse(css):
    """a tiny CSS reader: (kind, selector/prelude, body-or-decls) tree"""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    i, n = 0, len(css)
    def block(i):
        """i is just after '{'; returns (items, j) where j is after the matching '}'"""
        items = []
        while i < n:
            while i < n and css[i] in " \t\r\n": i += 1
            if i >= n: break
            if css[i] == "}": return items, i + 1
            j = i
            depth_q = None
            while j < n and css[j] not in "{;}" :
                j += 1
            if j >= n: break
            head = css[i:j].strip()
            if css[j] == "{":
                inner, k = block(j + 1)
                items.append(("at" if head.startswith("@") else "rule", head, inner))
                i = k
            else:
                # a declaration (or stray) at this level
                if css[j] == ";": items.append(("decl", head, None)); i = j + 1
                else: items.append(("decl", head, None)); i = j
        return items, i
    items, _ = block(0)
    return items

def decls_of(inner):
    """the rule body: a list of (prop, value, important) - the raw text between braces was
       parsed as 'decl' items split on ';' by block() only at depth 0 of braces; values with
       ';' inside quotes are rare here and tolerated"""
    out = []
    for kind, head, _ in inner:
        if kind != "decl": continue
        for d in split_top(head, ";"):
            d = d.strip()
            if not d or ":" not in d: continue
            prop, _, val = d.partition(":")
            val = val.strip(); imp = False
            if val.lower().endswith("!important"):
                imp = True; val = val[:-10].strip()
            out.append((prop.strip(), val, imp))
    return out

def emit(items, depth, out):
    pad = "  " * depth
    for kind, head, inner in items:
        if kind == "at":
            low = head.lower()
            if low.startswith("@keyframes") or low.startswith("@font-face") or low.startswith("@import") or low.startswith("@charset"):
                continue
            sub = []
            emit(inner, depth + 1, sub)
            if sub:
                out.append(pad + head + "{")
                out.extend(sub)
                out.append(pad + "}")
        elif kind == "rule":
            sels = [s.strip() for s in split_top(head)]
            if any(s.startswith("html[data-mono]") or "[data-mono]" in s for s in sels):
                continue                                  # the wireframe is not ours to touch
            decls = []
            for prop, val, imp in decls_of(inner):
                t = transform_decl(prop, val, imp)
                if t: decls.append(t)
            if not decls: continue
            scoped = ",".join(scope_selector(s) for s in sels)
            body = ";".join(p + ":" + v + ("!important" if i else "") for p, v, i in decls)
            out.append(pad + scoped + "{" + body + "}")

def main():
    tpl = io.open(TPL, encoding="utf-8").read()
    a = tpl.index("<style>") + len("<style>"); b = tpl.index("</style>", a)
    css = tpl[a:b]
    items = parse(css)
    shadow = []
    emit(items, 1, shadow)
    hand = io.open(HAND, encoding="utf-8").read() if os.path.exists(HAND) else ""
    fonts = """
@font-face{font-family:"Fraunces";font-style:normal;font-weight:400 500;font-display:swap;src:url(fonts/fraunces-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"Fraunces";font-style:normal;font-weight:400 500;font-display:swap;src:url(fonts/fraunces-latin-ext.woff2) format("woff2");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:"IBM Plex Sans";font-style:normal;font-weight:400 600;font-display:swap;src:url(fonts/plex-sans-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"IBM Plex Sans";font-style:normal;font-weight:400 600;font-display:swap;src:url(fonts/plex-sans-latin-ext.woff2) format("woff2");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:"IBM Plex Mono";font-style:normal;font-weight:400;font-display:swap;src:url(fonts/plex-mono-400-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"IBM Plex Mono";font-style:normal;font-weight:400;font-display:swap;src:url(fonts/plex-mono-400-latin-ext.woff2) format("woff2");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:"IBM Plex Mono";font-style:normal;font-weight:500;font-display:swap;src:url(fonts/plex-mono-500-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"IBM Plex Mono";font-style:normal;font-weight:500;font-display:swap;src:url(fonts/plex-mono-500-latin-ext.woff2) format("woff2");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
"""
    head = ("/* AtomOne app - DAY theme. GENERATED by bin/dev/daygen.py from page.tpl's stylesheet\n"
            "   plus bin/dev/theme-day.hand.css; do not edit by hand. Applies when <html data-theme=light>\n"
            "   (the switch in the bar, or the browser's preference), never to the wireframe; night is untouched. */\n")
    tokens = "  " + SCOPE + "{" + re.sub(r"\s+", "", TOKENS) + "}\n"
    # the night sheet's own tokens, re-pointed: rules that use var(--wt) etc. need no copy
    night_tokens = ("  " + SCOPE + "{--void:var(--bg);--edge:var(--line);--edge2:var(--line-strong);--ink2:var(--muted);--ink3:var(--faint);"
                    "--hot:var(--warn);--burn:var(--danger);--cold:var(--accent);--lit:var(--ink);--card:var(--surface);--card2:var(--surface-2);"
                    "--inset:var(--surface-sunk);--blue:var(--accent);--cyan:var(--accent);--green:var(--accent);--amber:var(--warn);"
                    "--cv:var(--bg);--ce:var(--line);--ce2:var(--line-strong);--ci:var(--ink);--ci2:var(--muted);--ci3:var(--faint);--cf:var(--faint);"
                    "--ch:var(--warn);--cb:var(--danger);--cc:var(--accent);--cl:var(--ink);"
                    "--mono:var(--day-mono);--sans:var(--day-sans)}\n"
                    "  " + SCOPE + " #p-dele," + SCOPE + " #p-dele *," + SCOPE + " #p-intro," + SCOPE + " .pop," + SCOPE + " .pop *,"
                    + SCOPE + " #sv," + SCOPE + " #sv *," + SCOPE + " #you," + SCOPE + " #you *," + SCOPE + " #paths," + SCOPE + " #paths *," + SCOPE + " .hdr-r," + SCOPE + " .hdr-r *," + SCOPE + " .brandbar," + SCOPE + " .brandbar *{"
                    "--wc:var(--surface);--wh:var(--surface-2);--wbd:var(--line);--wbd2:var(--line-strong);--wi:var(--surface-sunk);--wchip:var(--surface-2);"
                    "--wt:var(--ink);--ws:var(--muted);--wf:var(--faint);--wblue:var(--accent);--wcyan:var(--accent);--wgreen:var(--accent);"
                    "--wamber:var(--warn);--wburn:var(--danger);--wgold:var(--warn);--wsans:var(--day-sans);--wmono:var(--day-mono)}\n")
    body = "\n".join(shadow)
    out = (head + fonts + "\n" + tokens + body + "\n" + night_tokens
           + "  /* ── the hand layer: the day spec's typography, shape, spacing and components ── */\n" + hand + "\n")
    tmp = OUT + ".tmp"
    io.open(tmp, "w", encoding="utf-8").write(out); os.replace(tmp, OUT)
    print("theme-day.css: %d shadow rules, %d bytes" % (len(shadow), len(out.encode("utf-8"))))

if __name__ == "__main__":
    main()
