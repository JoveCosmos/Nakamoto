"""The navigation shell, built from shell.json.

render.py calls build() with the config and the page template and splices the results in:
  SHELL_CFG  the config itself, embedded in <head> for boot.js (pre-paint) and shell.js
  SHELL_L1   the level-1 tablist (the sections) for the header
  SHELL_L2   one level-2 tablist per section, for the window's title row (and, for a section
             with a version switch, its Simple / Advanced control just before it)
  SHELL_CSS  the rules that key on html[data-sec] / html[data-sv] / html[data-svs]: which
             strip and which title show, which tab is lit, which dashboard screen is up.
             boot.js stamps those attributes before the first paint, so the right tab is lit
             before any script that follows has run.
Nothing about a tab is written by hand anywhere else: labels, routes, order, groups, accents.
A config that does not hold together refuses to render (the last good page keeps serving).
"""
import html
import json
import re

ROUTE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
ACCOUNT = ("none", "uses", "required")
OVERRIDE = {"ui", "panel", "screen", "tab", "label"}


def _esc(s):
    return html.escape(str(s), quote=True)


def _tint(hexcol, a=0.14):
    r, g, b = int(hexcol[1:3], 16), int(hexcol[3:5], 16), int(hexcol[5:7], 16)
    return f"rgba({r},{g},{b},{a})"


def validate(cfg, tpl):
    errs = []
    secs = cfg.get("sections") or []
    if not secs:
        errs.append("no sections")
    seen_sec, seen_route = set(), set()
    for s in secs:
        sid = s.get("id", "?")
        for k in ("id", "label", "route", "account", "accent"):
            if not s.get(k):
                errs.append(f"section {sid}: missing {k}")
        if s.get("id") in seen_sec:
            errs.append(f"section {sid}: duplicate id")
        seen_sec.add(s.get("id"))
        if s.get("route") in seen_route or s.get("route") == "intro":
            errs.append(f"section {sid}: route '{s.get('route')}' taken")
        seen_route.add(s.get("route"))
        if s.get("route") and not ROUTE.match(s["route"]):
            errs.append(f"section {sid}: bad route")
        if s.get("account") not in ACCOUNT:
            errs.append(f"section {sid}: account must be one of {ACCOUNT}")
        if s.get("accent") and not HEX.match(s["accent"]):
            errs.append(f"section {sid}: accent must be #rrggbb")
        if s.get("entry") not in (None, "first"):
            errs.append(f"section {sid}: entry, when given, is 'first'")
        subs = s.get("sub") or []
        if not subs:
            errs.append(f"section {sid}: needs at least one sub-view")
        ids, routes = set(), set()
        grouped = [bool(v.get("group")) for v in subs]
        if any(grouped) and not all(grouped):
            errs.append(f"section {sid}: either every sub-view has a group or none does")
        for v in subs:
            vid = v.get("id", "?")
            for k in ("id", "label", "route"):
                if not v.get(k):
                    errs.append(f"{sid}/{vid}: missing {k}")
            if v.get("id") in ids:
                errs.append(f"{sid}/{vid}: duplicate id")
            ids.add(v.get("id"))
            if v.get("route") in routes:
                errs.append(f"{sid}/{vid}: duplicate route")
            routes.add(v.get("route"))
            if v.get("route") and not ROUTE.match(v["route"]):
                errs.append(f"{sid}/{vid}: bad route")
            if v.get("tab"):
                if not v.get("panel"):
                    errs.append(f"{sid}/{vid}: a sub-view with a tab names its panel")
                elif not re.search(r"\bid=\"?%s\"?[\s>]" % re.escape(v["panel"]), tpl):
                    errs.append(f"{sid}/{vid}: panel #{v['panel']} is not in the page")
            else:
                e = v.get("empty") or {}
                if not (e.get("title") and e.get("text")):
                    errs.append(f"{sid}/{vid}: no tab, so it needs an empty state {{title, text}}")
            if v.get("accent") and not HEX.match(v["accent"]):
                errs.append(f"{sid}/{vid}: accent must be #rrggbb")
            for k in ("pro", "pro_b"):
                o = v.get(k)
                if o is None or o == "hide":
                    continue
                if not isinstance(o, dict) or set(o) - OVERRIDE:
                    errs.append(f"{sid}/{vid}: {k} is 'hide' or an object of {sorted(OVERRIDE)}")
                elif o.get("panel") and not re.search(r"\bid=\"?%s\"?[\s>]" % re.escape(o["panel"]), tpl):
                    errs.append(f"{sid}/{vid}: {k} panel #{o['panel']} is not in the page")
            if (v.get("pro") is not None or v.get("pro_b") is not None) and not s.get("version"):
                errs.append(f"{sid}/{vid}: 'pro' needs the section to have a version switch")
        ver = s.get("version")
        if ver:
            opts = [o.get("id") for o in ver.get("options") or []]
            if len(opts) != 2 or "pro" not in opts or len(set(opts)) != 2 or not all(o.get("label") for o in ver["options"]):
                errs.append(f"section {sid}: version has two options {{id, label}}, one of them 'pro'")
            if ver.get("default") not in opts:
                errs.append(f"section {sid}: version default must be one of its options")
            if ver.get("group") and ver["group"] not in [v.get("group") for v in subs]:
                errs.append(f"section {sid}: version group '{ver['group']}' is not one of its groups")
    home = (cfg.get("home") or "").split("/")
    if len(home) != 2 or not any(s.get("route") == home[0] and any(v.get("route") == home[1] for v in s.get("sub") or []) for s in secs):
        errs.append("home must name an existing section/sub-view route")
    if errs:
        raise SystemExit("atomone-app: FATAL shell.json: " + "; ".join(errs))


def _l2tab(s, v):
    panel = v.get("panel") or "p-empty"
    return (f'<button class=l2tab type=button role=tab id="l2-{_esc(s["id"])}-{_esc(v["id"])}" '
            f'aria-controls="{_esc(panel)}" aria-selected="false" tabindex="-1" '
            f'data-section="{_esc(s["id"])}" data-sub="{_esc(v["id"])}" data-key="{_esc(s["id"])}/{_esc(v["id"])}">'
            f'<span>{_esc(v["label"])}</span></button>')


def build(cfg, tpl):
    validate(cfg, tpl)
    secs = cfg["sections"]

    # ── level 1: the sections, in the header ──
    l1 = ['<nav class=l1 role=tablist aria-label="Sections">']
    for i, s in enumerate(secs):
        badge = f'<i class=l1badge>{_esc(s["badge"])}</i>' if s.get("badge") else ""
        hint = f' title="{_esc(s["hint"])}"' if s.get("hint") else ""
        l1.append(f'<button class=l1tab type=button role=tab id="l1-{_esc(s["id"])}" aria-controls="calc" '
                  f'aria-selected="false" tabindex="{0 if i == 0 else -1}" data-section="{_esc(s["id"])}" '
                  f'style="--acc:{s["accent"]};--tint:{_tint(s["accent"])}"{hint}>'
                  f'<span class=l1lbl>{_esc(s["label"])}</span>{badge}</button>')
    l1.append("</nav>")

    # ── level 2: one strip per section, in the window's title row ──
    l2 = []
    for s in secs:
        subs = s["sub"]
        groups = []
        for v in subs:
            g = v.get("group")
            if g and g not in groups:
                groups.append(g)
        ver = s.get("version")
        if ver:
            l2.append(f'<div class=l2ver data-for="{_esc(s["id"])}" role=group aria-label="{_esc(ver.get("group") or s["label"])} view">' +
                      '<span class=l2gl aria-hidden=true>View</span><div class=l2trk>' +
                      "".join(f'<button class=l2vb type=button data-ver="{_esc(o["id"])}" aria-pressed="false">{_esc(o["label"])}</button>'
                              for o in ver["options"]) + "</div></div>")
        attrs = (f'data-for="{_esc(s["id"])}" role=tablist aria-label="{_esc(s["label"])} views" '
                 f'style="--acc:{s["accent"]}"')
        if not groups:
            l2.append(f'<div class=l2 {attrs}><div class=l2trk>' + "".join(_l2tab(s, v) for v in subs) + "</div></div>")
        else:
            parts = []
            for g in groups:
                parts.append(f'<div class=l2g role=group aria-label="{_esc(g)}"><span class=l2gl aria-hidden=true>{_esc(g)}</span>'
                             '<div class=l2trk>' + "".join(_l2tab(s, v) for v in subs if v.get("group") == g) + "</div></div>")
            l2.append(f'<div class="l2 split" {attrs}>' + '<span class=l2div aria-hidden=true></span>'.join(parts) + "</div>")

    # ── the rules keyed on the pre-paint attributes ──
    def q(v):
        return '"' + str(v).replace('"', "") + '"'
    show_l2 = ",".join(f"html[data-sec={q(s['id'])}] .l2[data-for={q(s['id'])}]" for s in secs)
    show_ttl = ",".join(f"html[data-sec={q(s['id'])}] [data-title-for={q(s['id'])}]" for s in secs)
    lit_l1 = ",".join(f"html[data-sec={q(s['id'])}] .l1tab[data-section={q(s['id'])}]" for s in secs)
    lit_l2 = ",".join(f"html[data-sv={q(s['id'] + '/' + v['id'])}] .l2tab[data-key={q(s['id'] + '/' + v['id'])}]"
                      for s in secs for v in s["sub"])
    show_ver = ",".join(f"html[data-sec={q(s['id'])}] .l2ver[data-for={q(s['id'])}]" for s in secs if s.get("version"))
    lit_ver = ",".join(f"html[data-ver={q(o['id'])}] .l2vb[data-ver={q(o['id'])}]"
                       for o in {o["id"]: o for s in secs if s.get("version") for o in s["version"]["options"]}.values())
    # a tab the second version leaves out: the live layout reads 'pro', the preview (?dash=b) 'pro_b'
    hide = []
    for s in secs:
        for v in s["sub"]:
            key = q(s["id"] + "/" + v["id"])
            if v.get("pro") == "hide":
                hide.append(f'html[data-ver="pro"]:not([data-var="b"]) .l2tab[data-key={key}]')
            if (v["pro_b"] if "pro_b" in v else v.get("pro")) == "hide":
                hide.append(f'html[data-ver="pro"][data-var="b"] .l2tab[data-key={key}]')
    screens = sorted({v["screen"] for s in secs for v in s["sub"] if v.get("screen")})
    show_scr = ",".join(f"html[data-svs={q(x)}] .sv-screen[data-sc={q(x)}]" for x in screens)
    css = ("/* ── generated from shell.json by render.py (shellgen.py): do not edit here ── */\n"
           f"{show_l2}{{display:flex}}\n"
           f"{show_ttl}{{display:flex}}\n"
           f"{lit_l1}{{background:var(--tint);color:var(--l1-on);font-weight:500}}\n"
           f"{lit_l2}{{background:var(--l2-on);color:var(--l2-on-ink);font-weight:500}}\n"
           + (f"{show_scr}{{display:flex}}\n" if show_scr else "")
           + (f"{show_ver}{{display:inline-flex}}\n{lit_ver}{{background:var(--l2-on);color:var(--l2-on-ink);font-weight:500}}\n" if show_ver else "")
           + (",".join(hide) + "{display:none}\n" if hide else ""))

    blob = json.dumps(cfg, separators=(",", ":"), ensure_ascii=False)
    blob = blob.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    return {"SHELL_CFG": blob, "SHELL_L1": "".join(l1), "SHELL_L2": "".join(l2), "SHELL_CSS": css}
