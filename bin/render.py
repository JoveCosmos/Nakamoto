#!/usr/bin/env python3
"""
Render data.json into index.html. Pure function of the JSON - no network, no DB.
Split from collect.py so a render bug can never leave stale or partial DATA up:
collect writes data.json atomically, render writes index.html atomically.
"""
import html, json, os, re, sys

OUT = os.environ.get("OUT_DIR", "/srv/atomone-app/web")
D = json.load(open(os.path.join(OUT, "data.json")))
TESTNET = os.environ.get("NET", "mainnet") == "testnet"
NETCFG = ({"net": "testnet", "chain": "atomone-testnet-1", "name": "AtomOne Testnet",
           "api": "https://atomone-testnet-api.gatadao.com", "rpc": "https://atomone-testnet-rpc.gatadao.com", "other": "../", "base": "/testnet/"}
          if TESTNET else
          {"net": "mainnet", "chain": "atomone-1", "name": "AtomOne",
           "api": "https://atomone-api.gatadao.com", "rpc": "https://atomone-rpc.gatadao.com", "other": "testnet/", "base": "/"})
AVATARS = os.environ.get("AVATAR_DIR", "/srv/atomone-app/state/avatars")   # one cache for both networks

e, s, th, nk = D["eta"], D["set"], D["rule"], D["nakamoto"]
M = lambda u: u / 1e6
f = lambda n, d=0: f"{n:,.{d}f}"
# html.escape, and the template's own placeholder syntax neutralised: the page is built by a CHAIN of
# .replace("{{X}}", ...) calls, and str.replace also rewrites inside values already inserted - so a validator
# moniker of "{{DATA}}" would have pasted the whole payload into its table cell (audit 2026-10-13). "{" becomes
# its entity and renders identically; no chain string can ever spell a placeholder.
def esc(x, quote=True):
    return html.escape(str(x), quote).replace("{", "&#123;")

# ── the figure that decides the headline ─────────────────────────────────────
rate_line = (f"falling {abs(nk['rate_before']):.2f} points a week before the bonus"
             if nk["rate_before"] is not None else "trend not yet measurable")
if nk["rate_after"] is not None:
    after = f"<div class=r>{nk['rate_after']:+.2f}<span class=u> pts/wk</span></div>" \
            f"<div class=l>since the bonus, {nk['n_after']} weeks</div>"
else:
    after = (f"<div class=r style='color:var(--ink3)'>-</div>"
             f"<div class=l>since the bonus</div>"
             f"<div class=d><b>Too early to fit.</b> Only {nk['n_after']} full months since "
             f"{nk['bonus_from']}; a slope needs {nk['min_fit']}. Two points is one interval, "
             f"not a trend. {esc(nk['partial_month'])} is excluded as partial.</div>")

mv = D.get("move13")
def _m(n): return f"{n/1e6:.2f}M" if abs(n) >= 1e6 else f(n)
mv_top  = _m(mv["from_top"])   if mv else "-"
mv_small= _m(mv["to_small"])   if mv else "-"
mv_new  = _m(mv["bonded_delta"]) if mv else "-"
mv_grew = str(mv["grew"])      if mv else "-"
mv_wk   = str(mv["weeks"])     if mv else "-"

t10 = nk.get("t10_change")
if t10:
    t10_line = (f"Blocks proposed by the 10 largest validators "
                f"{'decreased' if t10['pct'] < 0 else 'increased'} by "
                f"{abs(t10['pct']):.1f}% in the {t10.get('weeks', t10['days'] // 7)} weeks since the bonus")
else:
    t10_line = "Share of blocks proposed by the ten largest validators" + (": N/A on testnet" if TESTNET else "")

# "Is it working?" is answered by the kink at the bonus line, not by two slopes
# side by side that the reader has to divide in their head. Do the division.
_rb, _ra = nk.get("rate_before"), nk.get("rate_after")
if _rb and _ra and _rb < 0 and _ra < 0:
    speedup     = f"{_ra / _rb:.1f}\u00d7"
    speedup_k   = "faster since bonus"
    speedup_sub = f"{_ra:+.2f} vs {_rb:+.2f} pts/wk"
elif _ra is not None and _rb is not None and _ra < 0 <= _rb:
    speedup     = "reversed"
    speedup_k   = "since the bonus"
    speedup_sub = f"was {_rb:+.2f}, now {_ra:+.2f} pts/wk"
elif _ra is not None:
    speedup     = f"{_ra:+.2f}"
    speedup_k   = "pts / week"
    speedup_sub = f"since the bonus, {nk.get('n_after', 0)} weeks"
else:
    speedup, speedup_k, speedup_sub = "-", "since the bonus", "not enough weeks yet"
if TESTNET:
    # what only the index knows: N/A, never a dash that reads as "not yet"
    speedup, speedup_sub = "N/A", "N/A on testnet"
    mv_top = mv_small = mv_new = mv_grew = mv_wk = "N/A"

def _pad5(rows, figs):
    """every Picks table keeps five rows: a list shorter than five (testnet has no history)
    is topped up with placeholder rows of the same height - a faded name bar, N/A figures"""
    have = rows.count("<tr")
    ph = ("<tr class=phr aria-hidden=true><td class=rkc>&ndash;</td><td class=nm><span class='tlg tlgx'></span><i class=phb></i></td>"
          + "<td class=dim>N/A</td>" * figs + "</tr>")
    return rows + ph * max(0, 5 - have)

def _eta_attr(r): return f"{r['eta']:.2f}" if r["eta"] is not None else ""
def _eta_cell(r): return f"{r['eta']:.2f}" if r["eta"] is not None else "<span class=dim>N/A</span>"
def _pct_cell(r): return f"{r['pct']:.0f}%" if r["pct"] is not None else "<span class=dim>N/A</span>"
es = D["eta_stats"]
# the direction today's concentration sets: toward the cap while C >= 3x, toward the floor below
_w2c, _w2f = es.get("weeks_to_cap"), es.get("weeks_to_floor")
if _w2c is not None:
    CAPSUB, CAPSUB2 = f"{_w2c} weeks, ~{_w2c/52:.1f} yr", f"{_w2c} weeks"
else:
    CAPSUB = "not while it falls" if _w2f else "at the floor: not while C &lt; 3&times;"
    CAPSUB2 = "not while falling"
STEPLINE = "&eta; " + ("Rising now" if th["rising"] else "Falling now" if (_w2f or 0) > 0 else "Held at the floor now") + f" (c = {th['ratio']:.2f}&times;)"
sched = "".join(
    f"<tr class='wk {'now' if r['now'] else 'next' if r['next'] else 'past' if r['past'] else 'fut'}'"
    f" tabindex=0 role=button data-w='{r['week']}' data-d='{esc(r['iso'])}' data-e='{_eta_attr(r)}'"
    f" data-s='{'now' if r['now'] else 'next' if r['next'] else 'past' if r['past'] else 'projected'}'>"
    f"<td>{r['week']}</td><td class=hdt>{esc(r['date'])}"
    f"{'<span class=tag-n>NOW</span>' if r['now'] else '<span class=tag-x>NEXT</span>' if r['next'] else ''}"
    f"</td><td>{_eta_cell(r)}</td><td>{_pct_cell(r)}</td>"
    f"<td class=hc>{f'{r[chr(99)]:.2f}&times;' if r['c'] is not None else ('N/A' if TESTNET and r['past'] else '-')}</td>"
    f"</tr>" for r in D["schedule"])

trend_rows = "".join(
    f"<tr><td>{esc(t['month'])}</td><td>{t['proposers']}</td><td>{t['nakamoto']}</td>"
    f"<td>{t['top10']:.2f}%</td></tr>" for t in D["trend"])

V = D["validators"]

# ── who actually pays best, and who pays best with a clean record ────────────
# Commission is the chain-wide floor for every validator in the set, so a
# commission column would be the same number a hundred times; stake is what the
# map is for. What is worth a column here is the record, because the top of the
# raw APR list is not the top of the list you would delegate to.
UP_MIN = 99.0
def _vlogo(v):
    vid = v.get("id") or ""
    return (f"<img class=tlg src=\"assets/val/{esc(vid)}.jpg\" alt=\"\" loading=lazy>"
            if v.get("av") and re.fullmatch(r"[A-Za-z0-9_.-]{1,32}", vid)
            else "<span class='tlg tlgx'></span>")

def prow(v, extra):
    return (f"<tr class=vrow tabindex=0 role=button data-v={v['rank']-1}>"
            f"<td class=rkc>{v['rank']}</td>"
            f"<td class=nm>{_vlogo(v)}<span>{esc(v['m'])}</span></td>"
            f"<td class='{'up' if v['t'] < s['mean'] else 'dn'}'>{v['net']*100:.1f}%</td>"
            f"{extra}</tr>")

by_apr = sorted(V, key=lambda v: -v["apr"])
def _jail(v):
    """the jail count cell: N/A where the index has no record (testnet)"""
    if v.get("jail") is None: return "<td class=dim>N/A</td>"
    return f"<td class='{'warn' if v['jail'] else 'ok'}'>{v['jail'] if v['jail'] else 'Never'}</td>"
def _up(v):
    return (f"{(1 - v['life_missed']/v['life_n'])*100:.2f}%"
            if v.get("life_up") is not None and v["life_n"] else ("N/A" if TESTNET else "-"))
tbl_apr = "".join(
    prow(v, f"<td class={'ok' if v.get('life_up') is not None and v['life_n'] else 'dim'}>{_up(v)}</td>"
            f"{_jail(v)}") for v in by_apr)

# ── the longest clean signing record we can actually prove ──────────────────
# Ranked on the ratio, not the miss count: a validator that joined in June has a
# shorter window and an easier record, and the ratio prices that in. A floor on
# the window keeps a two-week-old validator off the list entirely.
LIFE_MIN = 500_000
def _kf(n):                                   # 10,448,436 -> 10.4M, 572,164 -> 572k
    return (f"{n/1e6:.1f}M" if n >= 1e6 else f"{n/1e3:.0f}k" if n >= 1e3 else str(n))
cov = D["coverage"]
lv = [v for v in V if v.get("life_up") is not None and v["life_n"] >= LIFE_MIN]
lv.sort(key=lambda v: (-(1 - v["life_missed"] / v["life_n"]), -v["life_n"]))
tbl_up = "".join(
    f"<tr class=vrow tabindex=0 role=button data-v={v['rank']-1}>"
    f"<td class=rkc>{v['rank']}</td>"
    f"<td class=nm>{_vlogo(v)}<span>{esc(v['m'])}</span></td>"
    f"<td class=ok>{(1 - v['life_missed']/v['life_n'])*100:.4f}%</td>"
    # the window itself, so a record that began five weeks ago reads as five weeks
    f"<td title='{f(v['life_n'] - v['life_missed'])} blocks signed'>{_kf(v['life_n'] - v['life_missed'])}</td>"
    f"<td>{f(v['life_missed'])}</td>"
    f"{_jail(v)}</tr>" for v in lv)
life_win = f"{f(max((v['life_n'] for v in lv), default=0))}"

# ── what each validator actually earned, per epoch, uptime included ─────────
ev = [v for v in V if v.get("earn_avg") and v.get("earn_n", 0) >= 3]
ev.sort(key=lambda v: -v["earn_avg"])
tbl_earn = "".join(
    f"<tr class=vrow tabindex=0 role=button data-v={v['rank']-1}>"
    f"<td class=rkc>{v['rank']}</td>"
    f"<td class=nm>{_vlogo(v)}<span>{esc(v['m'])}</span></td>"
    f"<td class=ok>{v['earn_avg']*100:.1f}%</td>"
    f"<td>{v['earn_hi']*100:.0f}%</td><td>{v['earn_lo']*100:.0f}%</td></tr>" for v in ev)
earn_weeks = max((v["earn_n"] for v in ev), default=0)

n_clean = sum(1 for v in by_apr
              if not v["jail"] and not v["slash"] and not v["tomb"]
              and (v["d30"] if v["d30"] is not None else (v.get("up") or 0)) >= UP_MIN)

def knob_left(v, lo, hi):
    t = min(1.0, max(0.0, (v - lo) / (hi - lo)))
    return f"left:calc(12px + {t:.5f} * (100% - 24px))"

KL_ETA = knob_left(e["now"] * 100, 3, 100)
KL_C   = knob_left(th["ratio"] * 100, 100, 1600)
KL_S   = knob_left(s["bonded_pct"], 5, 100)

# each validator's detail as the page's scripts read it - nothing else rides in the page (the
# daily bars, the detail strings, the earning band... stay in data.json, which the refresh reads
# whole); a field a script starts to read is added here
# the validator id the page keys everything by is the FULL operator address (2026-10-01, audit H1: the
# last six characters were a 30-bit checksum a ground key could share, and the signed operator came
# from that map). Every operator must be a well-formed valoper and appear once, active or inactive
_OPS = [v.get("op") for v in V] + [v.get("op") for v in D.get("inactive") or []]
for _op in _OPS:
    if not isinstance(_op, str) or not re.fullmatch(r"atonevaloper1[02-9ac-hj-np-z]{38}", _op):
        sys.exit("atomone-app: FATAL operator address %r is not a valoper" % (_op,))
if len(set(_OPS)) != len(_OPS):
    sys.exit("atomone-app: FATAL an operator address is listed twice (active and inactive)")
VD_KEYS = ("op", "chex", "id", "vid", "m", "t", "c", "jail", "tomb", "burned", "vp", "up", "d30", "d90",
           "life_up", "life_n", "life_missed", "prop", "joined", "last_slash", "earn_avg", "web", "av")
payload = json.dumps({"generated": D["generated"], "thresh": th["threshold"],
                      "bot": D.get("bot"),
                      "gav": D.get("gav") or [],      # governor identities with a published Keybase tile
                      "hist_from": D.get("hist_from"),  # the public node's first block time (partial vote records)
                      "alert": D.get("alert"),
                      "weekly": nk["weekly"], "schedule": D["schedule"], "eta_stats": es,
                      "vdetail": [{k: v[k] for k in VD_KEYS if k in v} for v in D["validators"]],
                      "validators": [[v["m"], v["t"], v["c"], v["op"], (v.get("jail") if TESTNET else (v.get("jail") or 0)),
                                      round((1 - v["life_missed"]/v["life_n"]) * 100, 3)
                                      if v.get("life_n") else None] for v in V],
                      # [moniker, tokens, commission, id, jailed 0/1, operator]: the operator so an inactive
                      # (not jailed) validator can be staked to or redelegated to from the lists; id = operator
                      # since 2026-10-01, the sixth field stays for the page's existing reads
                      "inactive": [[v["m"], v["t"], v["c"], v["op"], 1 if v["jailed"] else 0, v["op"]] for v in D.get("inactive") or []],
                      "eta": e, "set": s,
                      # the Network tabs: 24h proposers, 7 days of hourly activity, the economics
                      # history, and where the chain's record starts
                      "p24": D.get("p24"), "act7": D.get("act7"), "txday": D.get("txday"), "b10k": D.get("b10k"), "prices": D.get("prices"), "econ": D.get("econ"), "prop_all": D.get("prop_all"),
                      "coverage": D.get("coverage"),
                      # the network this page is for: its endpoints for the scripts, and the other
                      # network's page for the switch
                      "net": NETCFG}, separators=(",", ":"))

TPL = open(os.path.join(os.path.dirname(__file__), "page.tpl")).read()
# the navigation shell: both tab strips, their pre-paint CSS and the embedded config all come
# from shell.json (see shellgen.py) - no tab label is written anywhere else
import shellgen
SHELL = shellgen.build(json.load(open(os.path.join(os.path.dirname(__file__), "shell.json"))), TPL)
for _k, _v in SHELL.items():
    if TPL.count("{{%s}}" % _k) != 1:
        sys.exit("atomone-app: FATAL page.tpl must carry {{%s}} exactly once" % _k)
    TPL = TPL.replace("{{%s}}" % _k, _v)
# the dev tree stamps <html data-stage=dev>: features held back from a release show on dev only (operator, 2026-10-02:
# "Register governor should be visible in dev"); production's render writes nothing here
STAGE = " data-stage=dev" if os.path.realpath(OUT).startswith("/srv/atomone-app-dev/") else ""
page = (TPL
  .replace("{{STAGE}}", STAGE)
  .replace("{{GENERATED}}", D["generated"]).replace("{{HEIGHT}}", f(D["height"]))
  .replace("{{CHAIN}}", esc(D["chain"])).replace("{{CHAIN_ID}}", esc(NETCFG["chain"])).replace("{{BASE}}", NETCFG["base"])   # the popups' chain line, per network
  .replace("{{ETA}}", f"{e['now']:.2f}").replace("{{ETA_PCT}}", f"{e['now']*100:.0f}")
  .replace("{{ETA_NEXT}}", f"{next((r['eta'] for r in D['schedule'] if r['next']), e['now']):.2f}")
  .replace("{{NOW_DATE}}", next((r["date"] for r in D["schedule"] if r["now"]), "-"))
  .replace("{{RATE_AFTER}}", f"{nk['rate_after']:+.2f}" if nk["rate_after"] is not None else ("N/A" if TESTNET else "-"))
  .replace("{{N_AFTER}}", str(nk["n_after"]))
  .replace("{{NEXT_DATE}}", next((r["date"] for r in D["schedule"] if r["next"]), "-"))
  .replace("{{WEEK}}", str(e["week"])).replace("{{WEEKDAY}}", str(e["week_day"]))
  .replace("{{MIN}}", f"{e['min']:.2f}").replace("{{MAX}}", f"{e['max']:.2f}")
  .replace("{{STEP}}", f"{e['step']:.2f}")
  # testnet has no indexed proposals: who could halt it is read from the stake itself
  .replace("{{NK}}", str(nk["proposals"]) if nk["proposals"] is not None else (str(nk["stake"]) if TESTNET and nk.get("stake") else "N/A")).replace("{{NK_STAKE}}", str(nk["stake"]))
  .replace("{{RATIO}}", f"{th['ratio']:.2f}").replace("{{THRESH}}", f"{th['threshold']:.2f}").replace("{{THRESH_N}}", f"{th['threshold']:g}")
  .replace("{{TRIPS}}", f"{th['threshold'] - 0.01:.2f}")
  .replace("{{TRIPS_C}}", str(int(round((th['threshold'] - 0.01) * 100))))
  .replace("{{HIGH}}", f(M(th["high_avg"]))).replace("{{LOW}}", f(M(th["low_avg"])))
  .replace("{{MOVE}}", f(M(th["move_to_reverse"])))
  .replace("{{MOVE_PCT}}", f"{th['move_pct_bonded']:.1f}")
  .replace("{{MOVE_TOP}}", f"{th['move_pct_top']:.1f}")
  .replace("{{MOVE_EACH}}", f(M(th["move_each"])))
  .replace("{{LOW_AFTER}}", f(M(th["low_avg_after"])))
  .replace("{{GROUP}}", str(th["group"])).replace("{{GROUP_LO}}", str(th["group_lo"]))
  .replace("{{MOVE_FROM}}", th["move_from"]).replace("{{MOVE_TO}}", th["move_to"])
  .replace("{{N}}", str(s["n"])).replace("{{MEAN}}", f(M(s["mean"])))
  .replace("{{BASE_APR}}", f"{s['base_apr']*100:.2f}")
  .replace("{{BONDED_C}}", f"{M(s['bonded'])/1e6:.1f}M")
  .replace("{{BONDED}}", f(M(s["bonded"]))).replace("{{BONDED_PCT}}", f"{s['bonded_pct']:.1f}")
  .replace("{{INFL}}", f"{s['inflation']*100:.0f}")
  .replace("{{SUPPLY}}", f(M(s["supply"]))).replace("{{TAX}}", f"{s['community_tax']*100:.0f}")
  .replace("{{BELOW}}", str(s["below_mean"]))
  .replace("{{REST_PCT}}", f"{100 - e['now']*100:.0f}")
  .replace("{{DELEG}}", f(D["delegators"]["unique"]) if D.get("delegators") else "-")
  .replace("{{MINTED}}", f(M(s["inflation"] * s["supply"])))
  .replace("{{CTAKE}}", f(M(s["inflation"] * s["supply"] * s["community_tax"])))
  .replace("{{MINCOMM}}", f"{s['min_commission']*100:.0f}").replace("{{CPOOL}}", f(M(s["community_pool"])))
  # only one of these two can be true, and it is the live state, not a legend
  .replace("{{RISE_ON}}", "hot" if th["rising"] else "")
  .replace("{{FALL_ON}}", "" if th["rising"] else "hot")
  .replace("{{POOL}}", f(M(s["reward_pool"])))
  .replace("{{TOP10}}", f"{nk['top10_now']:.1f}" if nk["top10_now"] is not None else "N/A").replace("{{TOP10_FIRST}}", f"{nk['top10_first']:.1f}" if nk["top10_first"] is not None else "N/A")
  .replace("{{RATE_BEFORE}}", f"{nk['rate_before']:+.2f}" if nk["rate_before"] is not None else ("N/A" if TESTNET else "-"))
  .replace("{{N_BEFORE}}", str(nk["n_before"]))
  .replace("{{AFTER_BLOCK}}", after).replace("{{RATE_LINE}}", rate_line)
  .replace("{{FLOOR}}", f"{es['floor']:.2f}").replace("{{CAP}}", f"{es['cap']:.2f}")
  .replace("{{HIGHEST}}", f"{es['highest']:.2f}").replace("{{HIGHEST_WK}}", str(es['highest_week']))
  .replace("{{CAPSUB}}", CAPSUB).replace("{{CAPSUB2}}", CAPSUB2).replace("{{STEPLINE}}", STEPLINE)
  .replace("{{REV_WHEN}}", ("&lt; " if th["rising"] else "&ge; ") + f"{th['threshold']:.2f}&times;")
  .replace("{{W2CAP}}", str(es['weeks_to_cap'])).replace("{{TODAY}}", esc(es["today"]))
  .replace("{{START_DATE}}", esc(D["schedule"][0]["date"]) if D.get("schedule") else "-")
  .replace("{{Y2CAP}}", f"{es['weeks_to_cap']/52:.1f}" if es.get("weeks_to_cap") is not None else "N/A")
  .replace("{{T10LINE}}", esc(t10_line))
  .replace("{{SPEEDUP}}", speedup).replace("{{SPEEDUP_K}}", speedup_k)
  .replace("{{SPEEDUP_SUB}}", esc(speedup_sub))
  .replace("{{KL_ETA}}", KL_ETA).replace("{{KL_C}}", KL_C).replace("{{KL_S}}", KL_S)
  .replace("{{MV_TOP}}", mv_top).replace("{{MV_SMALL}}", mv_small)
  .replace("{{MV_NEW}}", mv_new).replace("{{MV_GREW}}", mv_grew).replace("{{MV_WK}}", mv_wk).replace("{{SCHEDULE}}", sched).replace("{{TRENDROWS}}", trend_rows)
  .replace("{{APRTABLE}}", _pad5(tbl_apr, 3))
  .replace("{{NCLEAN}}", "N/A" if TESTNET else str(n_clean)).replace("{{UPMIN}}", f"{UP_MIN:.0f}")
  .replace("{{PICKTABLE}}", "").replace("{{LIFEWIN}}", life_win)
  .replace("{{UPTABLE}}", _pad5(tbl_up, 4))
  .replace("{{EARNTABLE}}", _pad5(tbl_earn, 3)).replace("{{EARNWK}}", "N/A" if TESTNET else str(earn_weeks))
  .replace("{{COVFROM}}", "genesis" if cov["genesis"] else esc(cov["from_date"]))
  .replace("{{DATA}}", payload.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")))
# ^ the payload sits inside a <script> element: a moniker containing "</script>"
#   would end the element and inject markup. JSON string escapes are transparent
#   to JSON.parse, so the data is unchanged and the parser can never see a tag.

# app.js is static but published from bin/ so /srv/atomone-app/web is entirely
# reproducible - nothing in it is hand-edited, and a stale copy cannot linger.
import shutil, subprocess, hashlib
# A save re-renders within a second (atomone-app-render.path), so a script that
# does not parse must never reach web/: the last good page keeps serving instead.
for _js in ("app.js", "boot.js", "tx.js", "simple.js", "shell.js"):
    _chk = subprocess.run(["/usr/bin/node", "--check", os.path.join(os.path.dirname(__file__), _js)],
                          capture_output=True, text=True)
    if _chk.returncode != 0:
        sys.exit("atomone-app: FATAL %s does not parse:\n%s" % (_js, _chk.stderr.strip()[-600:]))
for _js in ("app.js", "boot.js", "tx.js", "simple.js", "shell.js"):
    shutil.copyfile(os.path.join(os.path.dirname(__file__), _js),
                    os.path.join(OUT, "." + _js + ".tmp"))
    os.chmod(os.path.join(OUT, "." + _js + ".tmp"), 0o640)
    os.replace(os.path.join(OUT, "." + _js + ".tmp"), os.path.join(OUT, _js))
# the operator console and the testnet faucet: each its own page and script (versioned by content), shared as a
# direct link (/admin, /faucet), never linked from the app. Built once, at the site root: the console switches
# networks itself and the faucet is testnet-only, so the testnet tree gets no copies.
for _pg in (() if TESTNET else ("admin",)):          # the faucet page is gone: the faucet is in the app (2026-09-30)
    _chk = subprocess.run(["/usr/bin/node", "--check", os.path.join(os.path.dirname(__file__), _pg + ".js")], capture_output=True, text=True)
    if _chk.returncode != 0:
        sys.exit("atomone-app: FATAL %s.js does not parse:\n%s" % (_pg, _chk.stderr.strip()[-600:]))
    _ajs = open(os.path.join(os.path.dirname(__file__), _pg + ".js"), "rb").read()
    _ah = open(os.path.join(os.path.dirname(__file__), _pg + ".html")).read().replace('src="%s.js"' % _pg, 'src="%s.js?v=%s"' % (_pg, hashlib.sha256(_ajs).hexdigest()[:10]))
    for _fn, _body in ((_pg + ".js", _ajs), (_pg + ".html", _ah.encode())):
        _t = os.path.join(OUT, "." + _fn + ".tmp"); open(_t, "wb").write(_body); os.chmod(_t, 0o640); os.replace(_t, os.path.join(OUT, _fn))
# Brand marks: AtomOne and PHOTON are the official chain-registry SVGs, GATA is the
# same mark the snapshot pages use. Published from bin/ like everything else.
# the Constitution view's text: the official file, converted once per render into a fragment the
# view fetches when it is opened (the page itself stays the size it was)
import constitution as _cn
_cd = os.path.dirname(__file__)
_cf = _cn.fragment(open(os.path.join(_cd, "constitution.md")).read(), json.load(open(os.path.join(_cd, "constitution.json"))))
_t = os.path.join(OUT, ".constitution.html.tmp"); open(_t, "w").write(_cf); os.replace(_t, os.path.join(OUT, "constitution.html"))
src_a = os.path.join(os.path.dirname(__file__), "assets")
dst_a = os.path.join(OUT, "assets")
os.makedirs(dst_a, exist_ok=True)
for fn in os.listdir(src_a):
    sp = os.path.join(src_a, fn)
    if os.path.isdir(sp):                      # assets/fonts: the day theme's self-hosted faces
        dd = os.path.join(dst_a, fn); os.makedirs(dd, exist_ok=True)
        for f2 in os.listdir(sp):
            t = os.path.join(dd, "." + f2 + ".tmp")
            shutil.copyfile(os.path.join(sp, f2), t); os.replace(t, os.path.join(dd, f2))
        continue
    t = os.path.join(dst_a, "." + fn + ".tmp")
    shutil.copyfile(sp, t)
    os.replace(t, os.path.join(dst_a, fn))
# the tab icon is the GATA mark (the same file the GATA app serves); browsers and
# bookmark tools also ask for /favicon.ico at the root, so it lives there too
t = os.path.join(OUT, ".favicon.ico.tmp")
shutil.copyfile(os.path.join(src_a, "favicon.ico"), t); os.replace(t, os.path.join(OUT, "favicon.ico"))

# Validator avatars, cached in state/ and published as static tiles so the browser
# never touches Keybase.
import glob
vdir = os.path.join(OUT, "assets", "val")
os.makedirs(vdir, exist_ok=True)
have = set()
for src in glob.glob(os.path.join(AVATARS, "*.jpg")):
    fn = os.path.basename(src); have.add(fn)
    dst = os.path.join(vdir, fn)
    if not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst):
        t = os.path.join(vdir, "." + fn + ".tmp"); shutil.copyfile(src, t); os.replace(t, dst)   # dot-prefixed, as above (2026-10-01)
for old_f in os.listdir(vdir):
    if old_f not in have:
        try: os.remove(os.path.join(vdir, old_f))
        except OSError: pass

# ── CSS sanity: a stray declaration fragment breaks the rule AFTER it ────────
# Deleting a multi-line rule by its first line leaves its tail behind, and a
# browser swallows the next rule recovering from it. That has bitten this page
# twice; it should never reach the server again.
import re as _re
_css = "\n".join(_re.findall(r"<style[^>]*>(.*?)</style>", page, _re.S))
_depth, _bad = 0, []
for _n, _l in enumerate(_css.split("\n"), 1):
    _t = _l.strip()
    if (_depth == 0 and _t and _t.endswith("}") and "{" not in _t
            and not _t.startswith(("/*", "*", "@", "}"))):
        _bad.append((_n, _t[:70]))
    _depth += _l.count("{") - _l.count("}")
if _bad:
    raise SystemExit("atomone-app: FATAL orphaned CSS fragment(s): "
                     + "; ".join(f"line {n}: {t}" for n, t in _bad))
if _depth != 0:
    raise SystemExit(f"atomone-app: FATAL unbalanced CSS braces ({_depth:+d})")

# The page and its scripts are cached for five minutes each, separately, so a
# reader could hold yesterday's app.js against today's markup - and a script that
# looks for an element the markup no longer has dies at bind time (the alert
# button "did nothing" that way on 2026-09-19). Versioning the script URLs by
# content makes a fresh page always fetch its own scripts.
import hashlib
for _js in ("app.js", "boot.js", "tx.js", "simple.js", "shell.js"):
    _h = hashlib.sha256(open(os.path.join(OUT, _js), "rb").read()).hexdigest()[:10]
    page = page.replace(f'src="{_js}"', f'src="{_js}?v={_h}"')
if TESTNET:
    page = page.replace("N/A%", "N/A")      # a template's "%" after a figure that is not there
# the day sheet the same way: a versioned URL can be cached for good (nginx says so for any
# ?v=), and a new sheet is a new URL
_day = os.path.join(OUT, "assets", "theme-day.css")
if os.path.exists(_day):
    _h = hashlib.sha256(open(_day, "rb").read()).hexdigest()[:10]
    page = page.replace('href="assets/theme-day.css"', f'href="assets/theme-day.css?v={_h}"')
tmp = os.path.join(OUT, ".index.html.tmp")
open(tmp, "w").write(page)
os.chmod(tmp, 0o640)                     # the published mode, whatever umask the caller had
os.replace(tmp, os.path.join(OUT, "index.html"))
print(f"atomone-app: rendered {len(page):,} bytes")
