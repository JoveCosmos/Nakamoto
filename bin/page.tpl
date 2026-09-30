<!doctype html><html lang=en><head><meta charset=utf-8>
<base href="{{BASE}}">
<meta name=viewport content="width=device-width,initial-scale=1">
<title>AtomOne Nakamoto Bonus</title>
<link rel=icon href="assets/favicon.ico" sizes="any"><link rel=icon type="image/png" sizes="32x32" href="assets/favicon-32.png"><link rel=icon type="image/png" sizes="192x192" href="assets/favicon-192.png"><link rel=apple-touch-icon href="assets/apple-touch-icon.png"><meta name=theme-color content="#06060c">
<script id=shellcfg type=application/json>{{SHELL_CFG}}</script>
<script src="boot.js"></script>
<meta name=description content="AtomOne's Nakamoto Bonus, live: what it pays, what would reverse it, and ten million blocks of evidence.">
<style>
:root{
color-scheme:dark;

/* the calculator's own palette, the page's first design: applied inside #p-home and its cards */
--cv:#06060c;--ce:#232342;--ce2:#34345c;--ci:#e6e4f0;--ci2:#a5a3c4;--ci3:#6f6d94;--cf:#4a4a68;--ch:#ffb02e;--cb:#ff4d1f;--cc:#6f66c8;--cl:#fff8dc;
--mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
--sans:"Helvetica Neue",Helvetica,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
*{box-sizing:border-box}
body{color:var(--ink);font-family:var(--sans);margin:0;line-height:1.5;
-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
background:radial-gradient(60% 50% at 80% -10%,rgba(59,158,255,.10),transparent 60%),
radial-gradient(50% 40% at 10% 100%,rgba(54,211,153,.05),transparent 60%)}
/* the calculator keeps the palette it was designed in; its window ground too */
html:not([data-tab=dele]) #calc,.pop .card:not(.txcard){--void:var(--cv);--edge:var(--ce);--edge2:var(--ce2);--ink:var(--ci);--ink2:var(--ci2);--ink3:var(--ci3);
--faint:var(--cf);--hot:var(--ch);--burn:var(--cb);--cold:var(--cc);--lit:var(--cl)}
/* hidden means hidden, whatever display a class sets */
[hidden]{display:none!important}
.w{max-width:1120px;margin:0 auto;padding:0 44px;position:relative;z-index:1}
@media(max-width:760px){.w{padding:0 20px}}

/* ── above the fold ── */
.fold{min-height:100svh;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:12px 0 14px}
/* the mark sits against the whole lockup - title AND slogan - rather than inside
   the title line, where it centred on the title alone and rode high over the pair */

.bwrap{display:flex;flex-direction:column;gap:2px;min-width:0}
.bt{font-size:var(--tfs);display:flex;
align-items:center;flex-wrap:wrap;line-height:1.1;gap:5px 9px}
/* the name never breaks mid-phrase - if space runs out the pill wraps instead */
.btx{white-space:nowrap}
.tsfx{font-style:normal}
.dot{width:5px;height:5px;border-radius:50%;background:#2ee06a;flex:0 0 auto;animation:beat 2.4s ease-out infinite}
.dot.stale{background:var(--hot);animation:none}
@keyframes beat{0%{box-shadow:0 0 0 0 #2ee06a99}70%{box-shadow:0 0 0 5px #2ee06a00}100%{box-shadow:0 0 0 0 #2ee06a00}}
@media(prefers-reduced-motion:reduce){.dot{animation:none}}

.fw{display:flex;flex-direction:column;gap:6px}
/* centre, not baseline: the coefficient button is boxed and the mode buttons are
   a different height, so aligning their text baselines left the row lopsided
   against the panel edge above and the grid below */
.frow{display:flex;align-items:center;gap:14px;flex-wrap:wrap;
min-height:24px;margin-bottom:4px}

/* uppercasing η yields Η - indistinguishable from a Latin H. Opt the symbol out. */
.lc{text-transform:none}
/* how many times the smallest out-earns the largest, written over the span it
   measures rather than as a footnote nobody ties back to the two figures */

.modes{display:flex;margin-left:auto}
.mbtn{color:var(--ink3);
font-family:var(--mono);text-transform:uppercase;
cursor:pointer}
.mbtn:hover{border-color:var(--ink3)}
.mbtn[aria-pressed=true]{border-color:var(--hot);}
.mbtn:focus-visible{outline:2px solid var(--hot);outline-offset:2px}
/* APR printed into the cell - third attempt, and the first that does not fight
   the map. Per-cell ink flipped colour mid-ramp and left a seam; a flat scrim
   fixed the seam but drained the colour the map exists to show. This keeps the
   fill untouched and carries contrast in the TYPE: one dark ink everywhere with
   a light halo around it. On the cold end the halo supplies the contrast, on the
   lit end the fill does, so it reads the whole way along without dimming
   anything. */
.cell .pct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
font-family:var(--mono);font-size:clamp(9px,.98vw,13.5px);letter-spacing:-.03em;
font-variant-numeric:tabular-nums;pointer-events:none;line-height:1;z-index:1;
/* no outline and no scrim: the ink is picked per cell from the fill's own
   luminance, so the digits sit flat on the colour */
}
.cell .pct em{font-style:normal;font-weight:800}
/* every mode but Map draws on one flat tile, so the number is the only thing
   carrying the cell: brighter, a size that lands on whole pixels, and a hairline
   edge so the tiles still read as a grid */
.grid.flat .cell{border:1px solid #ffffff17;border-radius:3px}
/* the figure is a tint of the tile's own fill with a shadow beneath it, so it
   sits in the tile instead of on it; the hash and unit stay a step dimmer */
.grid.flat .cell .pct{font-size:13px;letter-spacing:-.01em;color:#8f8fc8;
text-shadow:0 1px 1px #000000b0,0 -1px 0 #ffffff12}
.grid.flat .cell:hover .pct,.grid.flat .cell:focus-visible .pct{color:#d9d8f0}
.grid.flat .cell .pct em{font-weight:700}
.grid.flat .cell .pct i{opacity:.8;font-size:.7em;font-weight:600}
@media(max-width:620px){.grid.flat .cell .pct{font-size:10px;letter-spacing:-.03em}
.grid.flat .cell .pct i{font-size:.66em}}
@media(max-width:400px){.grid.flat .cell .pct{font-size:9px}}
.cell .pct i{font-style:normal;font-weight:700;font-size:.62em;opacity:.62;margin-left:1px;
position:relative;top:.06em}
.cell .pct i.hash{margin:0 1px 0 0;top:0}
/* 20 across, so 100 validators land in 5 even rows of noticeably larger cells:
   easier to hit, easier to read a figure inside, and tall enough that the
   chart can stand in for the grid without the page jumping */
.grid{display:grid;grid-template-columns:repeat(20,1fr);gap:4px}
#cwrap{flex:none;width:100%}
#foldchart{display:block;max-height:none;margin:0}
/* The grid is built by script, so before it runs the section has no height and
   the panels below it jump up the page, then jump back. Reserve the space the
   cells will take: 20 square columns over 5 rows is almost exactly 4:1, and on a
   phone 10 columns over 10 rows is exactly 1:1. Cleared once the cells exist so
   the real content governs from then on. */
#gwrap{aspect-ratio:4/1}
@media(max-width:620px){#gwrap{aspect-ratio:1/1}}

@media(max-width:620px){.grid{grid-template-columns:repeat(10,1fr)}}
.cell{aspect-ratio:1;border-radius:3px;position:relative;overflow:hidden;cursor:pointer}
/* an open place in the set: a quiet grey box, not a validator - no colour, no hover */
.cell.pad{background:rgba(255,255,255,.045);border:1px dashed rgba(255,255,255,.1);cursor:default;pointer-events:none}
/* the heat tiles are lit prisms rather than flat swatches: a light catch along
   the top-left, shade toward the bottom-right, a hairline rim so even the
   darkest tile keeps an edge, and a shallow drop so they lift off the frame */
.grid:not(.flat) .cell{background-image:linear-gradient(155deg,rgba(255,255,255,.09) 0,
rgba(255,255,255,.02) 42%,rgba(0,0,0,0) 58%,rgba(0,0,0,.30) 100%);
box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 1px 0 0 rgba(255,255,255,.03),
inset 0 -1px 0 rgba(0,0,0,.5),inset -1px 0 0 rgba(0,0,0,.25),0 1px 2px rgba(0,0,0,.55)}
.grid:not(.flat) .cell.halt{box-shadow:0 0 0 1.5px var(--burn),0 0 12px 1px #ff4d1f66,
inset 0 1px 0 rgba(255,255,255,.14),inset 0 -1px 0 rgba(0,0,0,.5)}
/* the mark carries the cell in this mode, so it fills it rather than floating at
   half size in the middle; the heat colour stays visible as the surround */
.cell img{position:absolute;inset:11%;width:78%;height:78%;border-radius:50%;object-fit:cover;
opacity:1;pointer-events:none;box-shadow:0 0 0 1px #00000055}
/* the halting set: the smallest group that could stop the chain */
.cell.halt{box-shadow:0 0 0 1.5px var(--burn),0 0 12px 1px #ff4d1f66;z-index:2}
/* hover: the tile lifts toward the reader - a light rim, a warm glow, a
   touch of scale - and settles back when the pointer leaves */
.cell{transition:transform .16s cubic-bezier(.2,.7,.3,1),box-shadow .16s,filter .16s}
.cell:hover,.cell:focus-visible{outline:0;z-index:3;transform:translateY(-1.5px) scale(1.06);
box-shadow:0 0 0 1.5px #fff8,0 0 0 3px #ffb02e55,0 6px 16px -2px #000c,0 0 14px #ffb02e66;
filter:brightness(1.12) saturate(1.08)}
.grid.flat .cell:hover .pct,.grid.flat .cell:focus-visible .pct{color:var(--lit);text-shadow:0 0 8px #ffb02e88}
@media(prefers-reduced-motion:reduce){.cell{transition:none}.cell:hover,.cell:focus-visible{transform:none}}
/* Three grid columns, not inline-flex inside a large-font span: the multiplier
   and its arrow sit in their own centre cell, so they cannot drift off the
   numbers' baseline the way a vertical-align hack did. */
/* hovering a tile turns the band's middle into that validator's line */
.apx.hov{color:var(--lit)}
.apx.hov b{color:var(--hot)}
.aprbar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px;
padding:0}
.apre{display:flex;flex-direction:column;gap:3px;min-width:0}
.apre.right{align-items:flex-end;text-align:right}
.apnum{font-family:var(--mono);font-size:clamp(13px,1.4vw,17px);color:var(--lit);
letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1}
.aplab{font-family:var(--mono);font-size:8px;letter-spacing:.13em;text-transform:uppercase;
color:var(--ink3);white-space:nowrap}
.apmid{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0}
.apx{line-height:1;
font-variant-numeric:tabular-nums}
/* a measured span, not a glyph floating in the gap: the arrow reaches from one
   figure to the other, which is the distance the multiplier describes */
.apspan{position:relative;width:100%;height:1px;background:#8d8ab8}
.apspan::before,.apspan::after{content:"";position:absolute;top:-3.5px;width:8px;height:8px;
border-top:1.2px solid #8d8ab8;border-right:1.2px solid #8d8ab8}
.apspan::before{left:0;transform:rotate(-135deg)}
.apspan::after{right:0;transform:rotate(45deg)}
/* the ramp is its own band, labelled at both ends */

.ramp{height:10px;border-radius:2px;width:100%}

/* the step rate sits directly over the track it steps along */

/* flex:1 from the base rule grows along the CONTAINER axis - in this column
   that is height, which fattened the track. Pin it back. */

input[type=range]{-webkit-appearance:none;appearance:none;height:4px;flex:1;min-width:150px;max-width:340px;
background:linear-gradient(90deg,#2b1a5e,#c9331f,#ffc843,#fff8dc);outline:none;border-radius:2px}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;
background:var(--lit);cursor:grab;border:none;box-shadow:0 0 12px #ffb02ecc}
input[type=range]::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--lit);border:none}
input:focus-visible{box-shadow:0 0 0 4px #ffb02e55}
.chip{background:transparent;color:var(--ink2);border:1px solid var(--edge2);border-radius:2px;
padding:7px 12px;font-family:var(--mono);font-size:11.5px;cursor:pointer;letter-spacing:.05em}
.chip:hover{color:var(--ink);border-color:var(--ink3)}
.chip[aria-pressed=true]{background:var(--burn);color:#fff;border-color:var(--burn)}
.chip:focus-visible{outline:2px solid var(--hot);outline-offset:2px}

/* ── below ── */
section{padding:70px 0;border-top:1px solid var(--edge)}
h2{font-size:clamp(23px,2.9vw,33px);line-height:1.1;letter-spacing:-.028em;font-weight:800;margin:14px 0 0;max-width:22ch}
.sub{font-size:16px;color:var(--ink2);margin:14px 0 28px;max-width:60ch}
.sub b,.note b{color:var(--ink)}
.scroll{overflow-x:auto}
svg{display:block;width:100%;height:auto}
svg text{font-family:var(--mono);font-variant-numeric:tabular-nums}
.sbox{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;
background:var(--edge);border:1px solid var(--edge2);margin-bottom:26px}
.sbox>*{background:var(--void);padding:18px 20px}
.sbox .v{font-family:var(--mono);font-size:30px;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.sbox .k{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--ink3);margin-top:8px}
.sbox .s{font-size:12px;color:var(--ink2);margin-top:5px}
/* the Projection's figures read label first: started at, today, cap, next - then the value */
#p-eta .sbox>*>.k:first-child{margin:0 0 7px}
/* the two Trend panels side by side: each subtitle keeps room for two lines, so the graphs and the
   boxes under them start on the same line whichever subtitle is longer */
@media(min-width:901px){#p-eta .panel>.sub{min-height:2.9em}}
/* the graphs keep their 42% when it fits and give way on a short window, so the boxes under them are
   never cut: nothing in a pane may fall below its frame (it is clipped, with no scroll to reach it) */
@media(min-width:901px){#p-eta .panel>svg[viewBox]{flex:0 1 42%;height:auto;min-height:80px}
#p-eta .panel>.sbox{flex:0 0 auto}}

table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:13.5px;font-variant-numeric:tabular-nums}
th{text-align:right;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--ink3);
font-weight:400;padding:0 14px 12px 0;border-bottom:1px solid var(--edge2)}
th:first-child,td:first-child{text-align:left}
/* th was right-aligned while td defaulted to left, so every column header sat
   over empty space instead of over its own numbers */
td{padding:12px 14px 12px 0;border-bottom:1px solid #23234288;color:var(--ink2);text-align:right}
tr.now td{color:var(--lit);background:#ff4d1f12}tr.next td{color:var(--hot)}tr.fut td{color:var(--ink3)}
tr.wk{cursor:pointer}tr.wk:hover td{background:#ff4d1f10;color:var(--ink)}
.tag-n{background:var(--burn);color:#fff;font-size:10px;letter-spacing:.12em;padding:3px 8px;border-radius:2px}
.tag-x{border:1px solid var(--hot);color:var(--hot);font-size:10px;letter-spacing:.12em;padding:3px 8px;border-radius:2px}
.nm{font-family:var(--sans);font-weight:600;font-size:14.5px;color:var(--ink)}
.up{color:var(--hot)}.dn{color:var(--cold)}

.note{font-size:13px;color:var(--ink3);margin-top:20px;max-width:64ch;line-height:1.6}

footer{padding:42px 0 64px;font-family:var(--mono);font-size:11px;color:var(--ink3);border-top:1px solid var(--edge)}

/* ── popups ── */
.pop{position:fixed;inset:0;display:none;align-items:center;justify-content:center;
z-index:50;}
.pop.on{display:flex}
.pop .card{max-width:470px;width:100%;
padding:26px 28px 0;position:relative;
overflow-y:auto;scrollbar-color:var(--edge2) #0b0b16;scrollbar-width:thin}
.pop .card::-webkit-scrollbar{width:10px}
.pop .card::-webkit-scrollbar-track{background:#0b0b16}
.pop .card::-webkit-scrollbar-thumb{background:var(--edge2);border-radius:5px}
/* the footer strip mirrors the header: the same gradient, turned over, and
   the same hairline, so the card is closed the way it was opened */
.vcard:not(.gcard)::after{content:"";display:block;height:16px;
border-top:1px solid #2b2b4a;background:linear-gradient(0deg,#191930 0,#0d0d18 100%)}
@media(max-width:620px){.vcard:not(.gcard)::after{height:13px}}

.pop .scroll{background:#0b0b16;scrollbar-color:var(--edge2) #0b0b16;scrollbar-width:thin}
.pop .scroll::-webkit-scrollbar{width:10px}
.pop .scroll::-webkit-scrollbar-track{background:#0b0b16}
.pop .scroll::-webkit-scrollbar-thumb{background:var(--edge2);border-radius:5px}
.pop table,.pop td,.pop th{background:#0b0b16}
/* validator card */
.pop .card.vcard{padding:0;max-width:520px}
.pop .card.hcard{max-width:660px;display:flex;flex-direction:column;overflow:hidden}
.hscroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 28px;margin-top:2px}
.hcard .vnote{padding:15px 28px 24px}
/* the one sentence this popup exists to deliver, given its own band */
/* was a tinted band in its own type size, which read as pasted in from another
   page; now it sits on the card like every other block, with only the figures
   picked out in the mono accent the rest of the panels use */
/* the one line of prose in this card, set exactly like the paragraph in the
   coefficient card so the two read as the same kind of block */
/* the ratio was a sentence hinged on two en-dashes, which broke across three
   ragged lines on a phone. Shown as the division it actually is, the two
   averages carry the figure and nothing has to wrap. */
.cband{padding:15px 28px 17px;border-bottom:1px solid var(--edge);
display:flex;flex-direction:column}
.cbcap{font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:#9a97c4;
align-self:center;margin:0 auto 11px;background:#12121f;border:1px solid var(--edge2);
border-radius:99px;padding:4px 12px;width:max-content}
.cbrow{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;
background:#0b0b16;border:1px solid var(--edge2);border-radius:11px;padding:15px 10px 16px}
.cbc{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center}
.cbl{font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3)}
.cbn{font-family:var(--mono);font-size:17px;font-weight:400;color:var(--hot);
letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.cbs{font-size:8.5px;letter-spacing:.1em;color:#5c5a80}
.cbx{color:#ff9b7a;width:27px;height:27px;
border-radius:50%;display:grid;place-items:center;background:#ff6a3d14;
border:1px solid #ff6a3d40;box-shadow:0 0 14px -6px #ff4d1f88}
.cbx svg{width:15px;height:15px;fill:currentColor}

#cpop .vhead,#spop .vhead{justify-content:center;position:relative}
/* only shown when the panel was reached from the coefficient card, so it is a
   way back rather than a dead control for anyone who opened C directly */
.backq{display:none;position:absolute;left:18px;top:50%;transform:translateY(-50%);
background:#ffb02e12;border:1px solid #ffb02e55;border-radius:99px;color:var(--hot);
font-family:var(--mono);font-size:11px;letter-spacing:.06em;padding:5px 11px;cursor:pointer}
.backq:hover{background:#ffb02e26;border-color:var(--hot);color:var(--lit)}
#cpop.fromq .backq{display:inline-flex;align-items:center;gap:4px}
@media(max-width:620px){.backq{left:12px;font-size:10px;padding:4px 9px}}
#cpop .vhid,#spop .vhid{display:flex;flex-direction:column;align-items:center;gap:11px}
#cpop .ck,#spop .ck{position:static;transform:none}
.cmid{text-align:center}
/* header rides along while the 100+ rows scroll under it */
.htab thead th{position:sticky;top:0;background:#0b0b16;z-index:1;padding-top:14px}
.htab th:nth-child(2),.htab td:nth-child(2){text-align:left}
/* every column is centred on its own header, so the eta figure no longer floats
   off the label above it; the table scrolls sideways rather than crushing the
   block number, which is the one column that must stay exact */
.htab th,.htab td{text-align:center}
.hdt{white-space:nowrap}
.hdt .tag-n,.hdt .tag-x{margin-left:6px}
.hc{font-variant-numeric:tabular-nums;color:var(--ink2)}
.hscroll{overflow-x:auto}
.vhead{display:flex;
}
.vlogo{width:54px;height:54px;border-radius:50%;flex:0 0 auto;background:#1a1a30;object-fit:cover}
/* Not every validator sets an identity on-chain, and three on this set do not.
   A blank disc reads as a broken image; an initial reads as a validator without
   a logo, which is what it is. */
.vmono{width:54px;height:54px;border-radius:50%;flex:0 0 auto;display:none;
align-items:center;justify-content:center;font-weight:800;color:#0b0b16}
.cell .mono{position:absolute;inset:11%;width:78%;height:78%;border-radius:50%;
display:flex;align-items:center;justify-content:center;font-weight:800;
font-size:clamp(11px,1.1vw,17px);color:#0b0b16;pointer-events:none;
box-shadow:0 0 0 1px #00000055}
.vhid{min-width:0}
.vname{font-weight:800;overflow-wrap:anywhere}

.vbadges{display:flex;flex-wrap:wrap;}
.badge{font-family:var(--mono);font-size:10px;
border:1px solid var(--edge2);color:var(--ink3)}
.badge.up{border-color:#ffb02e66;color:var(--hot)}
.badge.dn{border-color:#6f66c866;color:var(--cold)}
.badge.warn{border-color:#ff4d1f66;color:var(--burn)}
.badge.ok{border-color:#2ee06a55;color:#2ee06a}
.vgrid{display:grid;grid-template-columns:1fr 1fr;
}
.vstat{display:flex;flex-direction:column;
align-items:center;text-align:center}

.vk{text-transform:uppercase;}
.vv{font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--ink)}

/* rank rides with the name rather than spending a whole stat cell on one number */
/* its own column before the name, so the name and the description below it
   start at the same left edge instead of the name being pushed in by the rank */
.vrk{font-family:var(--mono);
border:1px solid var(--edge2);border-radius:99px;
vertical-align:middle;white-space:nowrap}
/* uptime strips. The 10k bar is the chain's own signing window - real uptime.
   The 30D/3M strips are days the validator proposed at all; a red column is a
   day it proposed nothing, which on this set means it was down. */
/* the last block in the card: without a bottom padding it sits 1px from the
   edge and reads as clipped */
.upsec{padding:18px 28px 20px;display:flex;flex-direction:column;gap:13px}
/* three plain figures - the bars said the same thing three times over */
.upnums{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--edge);
border:1px solid var(--edge)}
.upcell{background:#0b0b16;padding:10px 12px;display:flex;flex-direction:column;gap:4px}
.upn{font-family:var(--mono);font-size:17px;color:#2ee06a;font-variant-numeric:tabular-nums;
letter-spacing:-.02em;line-height:1}
.upl{font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);white-space:nowrap}
.pingwrap{display:flex;flex-direction:column;gap:6px}
/* newest column at the right, lit and beating, so the strip reads as live
   even when every block is signed and the bars are otherwise identical */
.upbars b{transition:background .25s}
.upbars b.tip{background:#7dffb0;animation:tipbeat 1.6s ease-out infinite}
@keyframes tipbeat{0%,100%{opacity:1}50%{opacity:.45}}
@media(prefers-reduced-motion:reduce){.upbars b.tip{animation:none}}

/* the one number a delegator came for, given a band of its own */

.pinghead .pingttl{justify-self:start}

.aprx{font-family:var(--mono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;
color:#8d86c9;display:flex;flex-direction:column;align-items:flex-end;gap:2px;
margin-left:auto;padding-left:18px}
.aprx b{font-weight:400;font-size:16px;letter-spacing:-.02em;color:#b9b0ff;
text-transform:none;line-height:1}
/* centred on the band and on the same line as the average - an absolutely
   positioned flex child otherwise sits at the top of the line, not on it */
/* centred on the band and on the same line as the average - an absolutely
   positioned flex child otherwise sits at the top of the line, not on it. One
   row, one colour, italic: an aside to the headline rate rather than a third
   figure competing with it. */
/* The big number is 34px tall and APR sat at its foot, leaving the space above
   the label empty. Net fills it: one small italic green line, an aside to the
   headline rate rather than a third figure competing with it. */
.aprstack{display:flex;flex-direction:column;align-items:flex-start;
justify-content:flex-end;gap:1px;align-self:flex-end;margin-bottom:2px}
.aprstack .aprlab{align-self:auto;margin-bottom:0;position:relative;left:-8px}
/* nudged, not re-laid-out: it stays the stack's second line, just set down and
   in from the APR above it so the two do not read as one block */
.aprnet{flex-direction:row;align-items:baseline;gap:3px;padding-left:0;margin-left:0;
text-transform:none;letter-spacing:.03em;font-style:italic;color:#7fd0a5;font-size:8px;
position:relative;top:6px;left:-2px}
.aprnet b{font-size:10.5px;}
@media(max-width:620px){
  .aprband .aprnet{font-size:7.5px;top:5px;left:-2px}
  .aprstack .aprlab{left:-6px}
  .aprband .aprnet b{font-size:9px}
  .aprband .aprlab{font-size:10px;letter-spacing:.14em}
}
.aprnet b{color:#7fd0a5;font-style:italic}
@media(max-width:620px){.aprx{font-size:8.5px;gap:4px}.aprx b{font-size:11.5px}}
.aprband{position:relative;display:flex;align-items:center;gap:14px;padding:16px 28px;
border-bottom:1px solid #2b2b4a;background:linear-gradient(90deg,#ffb02e16,#ffb02e03)}
.aprbig{font-family:var(--mono);font-size:34px;line-height:1;color:var(--hot);
letter-spacing:-.045em;font-variant-numeric:tabular-nums}
.aprlab{font-family:var(--mono);font-size:12px;letter-spacing:.18em;text-transform:uppercase;
color:var(--hot);opacity:.85;line-height:1.5;align-self:flex-end;margin-bottom:3px}
.pinghead{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px}
.pinghead .pingh{justify-self:end}
/* subscribe to this validator's downtime. A labelled action in Telegram's own
   blue, not a glyph tucked beside the strip - it was too easy to miss there. */
.notify{display:inline-flex;align-items:center;gap:5px;margin:-14px 0 0;flex:0 0 auto;
position:relative;z-index:2;
font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;
color:#9ed6f7;border:1px solid #5bb3e833;background:#5bb3e814;border-radius:5px;
padding:4px 11px;cursor:pointer;white-space:nowrap;font-weight:700;
transition:background .15s,border-color .15s,color .15s}
.notify:active{transform:translateY(1px)}
.notify svg{width:12px;height:12px;flex:0 0 auto}
/* the alert offer is the one thing on the card that asks for a decision, so it
   moves: a dashed frame marching round the button. A rect, so the dashes follow
   the rounded corners; it takes no pointer events and no layout of its own */
.notify .march{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.notify .march rect{x:.5px;y:.5px;width:calc(100% - 1px);height:calc(100% - 1px);rx:5px;ry:5px;
fill:none;stroke:#9ed6f7;stroke-width:1.2;stroke-dasharray:5 4;animation:march .9s linear infinite}
@keyframes march{to{stroke-dashoffset:-9}}
@media(prefers-reduced-motion:reduce){.notify .march rect{animation:none}}

/* the alert chooser */
.acard{max-width:430px}
/* a validator outside the active set: its own small card */
.icard{max-width:430px}
.iop{font-family:var(--mono);font-size:10.5px;color:var(--ink3)}
.icard .vbadges{padding:0 28px}
.inote{margin:12px 28px 0;font-size:12.5px;line-height:1.5;color:var(--ink2)}

.alist{display:flex;flex-direction:column;gap:1px;background:var(--edge);
border-top:1px solid var(--edge);border-bottom:1px solid var(--edge);margin-top:16px}
.aopt{display:flex;align-items:flex-start;gap:11px;background:#0b0b16;padding:11px 24px;cursor:pointer}
.aopt:hover{background:#12121f}
.aopt input{accent-color:#5bb3e8;width:15px;height:15px;margin:1px 0 0;flex:0 0 auto}
.aopt span{font-size:13px;color:var(--ink);line-height:1.3}
.aopt i{display:block;font-style:normal;font-size:10.5px;color:var(--ink3);margin-top:3px}
.tgbtn{display:flex;align-items:center;justify-content:center;gap:8px;margin:16px 24px 0;
background:#5bb3e8;color:#04222f;font-family:var(--mono);font-size:11px;letter-spacing:.12em;
text-transform:uppercase;font-weight:700;border-radius:6px;padding:11px;text-decoration:none}
.tgbtn:hover{background:#7cc6f0}
.tgbtn svg{width:14px;height:14px}
.tgbtn.off{opacity:.45;pointer-events:none}
#apop .vnote{padding:12px 24px 18px;line-height:1.7}
.notify:hover{background:#5bb3e82e;border-color:#5bb3e8;color:#9ed6f7}
@media(max-width:620px){.notify{font-size:8px;padding:3px 8px 3px 7px;letter-spacing:.06em;margin-top:-5px}
.notify svg{width:10px;height:10px}}
/* placeholder columns so the strip has its shape before the node answers, rather
   than appearing from nothing a second later */
.upbars b.wait{background:#23234a;animation:waitpulse 1.1s ease-in-out infinite}
@keyframes waitpulse{0%,100%{opacity:.35}50%{opacity:.75}}
@media(prefers-reduced-motion:reduce){.upbars b.wait{animation:none}}
/* reads as a tagline under the name, not as a link block: quiet by default,
   only colouring up on hover so it never competes with the name above it */
.vweb{font-family:var(--mono);font-size:9.5px;letter-spacing:.09em;color:var(--ink3);
text-decoration:none;opacity:.9;min-width:0;overflow:hidden;text-overflow:ellipsis;
white-space:nowrap}
.vweb[href]:hover{color:#9ed6f7;opacity:1}
/* validators that publish no site say so, rather than leaving a gap that reads
   as a layout fault */
.vweb.none{opacity:.5;font-style:italic;letter-spacing:.04em}
.pingttl{font-family:var(--mono);font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;
color:var(--ink3)}
.pingh{font-family:var(--mono);font-size:11px;color:var(--hot);font-variant-numeric:tabular-nums;
min-width:11ch;text-align:right;flex:0 0 auto}
/* the track IS the missed fraction: green covers what was signed, whatever
   shows through is what was not */
.upbars{display:flex;gap:1.5px;height:20px;align-items:flex-end;width:100%}
.upbars b{flex:1 1 0;min-width:0;background:#2ee06a;border-radius:1px;display:block}
.upbars b.z{background:var(--burn);box-shadow:0 0 5px #ff4d1faa}
/* not yet in the active set - absence of data, not an outage */
.upbars b.n{background:#20203c;box-shadow:none}
.upbars b.tip{box-shadow:0 0 6px #2ee06acc}

/* reads as a button, not as another outline chip in the selector row */

/* ── phone ─────────────────────────────────────────────────────────────────
   The fold stops forcing a full viewport here. Two 100-cell grids plus the
   control panel cannot fit one phone screen at a cell size you can still tap,
   and shrinking the cells to make them fit destroys the heat map - which is
   the whole page. Let it flow and scroll instead. */
@media(max-width:620px){
  .fold{min-height:auto;}

.aplab{font-size:8px;letter-spacing:.1em}

/* control panel: value, then the slider on its own full-width line, then
     chips stretched to thumb width */

.chip{flex:1 1 auto;text-align:center;padding:9px 8px;font-size:11px}

input[type=range]::-webkit-slider-thumb{width:24px;height:24px}
  input[type=range]::-moz-range-thumb{width:24px;height:24px}

  /* below the fold */
  section{padding:46px 0}
  .sub{font-size:15px;margin:12px 0 22px}
  .sbox>*{padding:15px 16px}
  .sbox .v{font-size:25px}

table{font-size:12px}
  th{padding:0 9px 10px 0;font-size:9px}
  td{padding:10px 9px 10px 0}
  .nm{font-size:13px}
  
  footer{padding:32px 0 48px}

  /* popups - every one of them, not just the validator card */
  
  .pop .card{padding:20px 18px 0;}
  .pop .e{font-size:42px}
  .pop dl{font-size:12px;gap:8px 14px}

.vlogo{width:44px;height:44px}

.upbars{gap:1px;}
  
  .upl{font-size:7.5px;letter-spacing:.08em}

.hscroll{padding:0 14px}
  .hcard .vnote{padding:13px 18px 20px}
  .cband{padding:12px 14px 14px}
  .cbrow{gap:7px}
  .cbn{font-size:14.5px}
  .cbl,.cbs{font-size:8px;letter-spacing:.1em}
  
  .htab thead th{padding-top:12px}
  .htab{font-size:12px}
  .htab th,.htab td{padding-right:7px}
  .htab th{font-size:9px;letter-spacing:.1em}
}
@media(max-width:400px){
  .w{padding:0 14px}

}

/* ── fold, rebuilt as stacked sections ─────────────────────────────────────── */
/* spacing comes from .bt's gap, not a margin: a margin-left survives the line
   break and indents the tags when they wrap under the title on a phone */
.tag{font-family:var(--mono);font-size:8.5px;letter-spacing:.11em;text-transform:uppercase;
color:var(--ink3);border:1px solid var(--edge);border-radius:99px;padding:3px 9px;
white-space:nowrap;display:inline-flex;align-items:center;gap:6px;
align-self:center;line-height:1.6;font-weight:400}
.tag.hot{border-color:#ff4d1f55;color:var(--burn)}

.sec{border:1px solid var(--edge2);border-radius:7px;padding:11px 15px 11px;
background:linear-gradient(180deg,#111124 0,#0b0b16 100%);
display:flex;flex-direction:column;gap:6px}
.sec.tight{padding:9px 15px 8px;gap:6px}
/* three near-identical panels sat side by side and read as one control repeated.
   Each now carries the colour of the thing it moves: amber for the coefficient,
   red for concentration, teal for the staked share - matching its button above
   and its knob. */
/* the three range sections are prisms in their own hue, like the tiles and the
   readouts above: a light catch, a rim, shade at the foot, a drop off the frame */
.duo .sec{box-shadow:inset 0 -1px 0 rgba(0,0,0,.55),0 2px 6px rgba(0,0,0,.6)}
.duo .sec:nth-child(1){border-color:#ffb02e3a;background:linear-gradient(180deg,#171226 0,#0b0a14 100%)}
.duo .sec:nth-child(2){border-color:#ff6a3d3a;background:linear-gradient(180deg,#1a1018 0,#0c090e 100%)}
.duo .sec:nth-child(3){border-color:#57d9d03a;background:linear-gradient(180deg,#0e1a20 0,#090e12 100%)}
/* the coefficient and the staked total are two separate controls; side by side
   keeps the fold on one screen and stops them reading as one long panel */
/* ── the what-if strip: three tracks, one reset, no chips. Every value is on the
   track; a white tick marks the chain as it is, and the strip turns amber the
   moment any handle leaves it, so a hypothetical never passes for the chain. */
/* each row resets itself: a circular arrow beside the value, only shown while
   the row's handle is away from live */
.rv{display:inline-flex;align-items:center;gap:6px}
/* the reset keeps its place whether shown or not, so the value never shifts */
/* A moved slider's way back, the way simulators say it: a verb and its target - "Reset to
   0.12" - in plain ink on its own fill (the moved value is amber; the action is not). It
   floats into the empty middle of the title row, just left of the value, so every value
   stays flush right and nothing shifts when it appears or goes. */
.rreset{height:24px;padding:0 10px 0 8px;border:1px solid var(--edge2);border-radius:99px;background:var(--card2);
color:var(--ink);font-family:var(--sans);font-size:11.5px;letter-spacing:0;text-transform:none;line-height:1;cursor:pointer;white-space:nowrap;
display:inline-flex;align-items:center;justify-content:center;gap:5px;visibility:hidden;opacity:0;transition:opacity .15s,border-color .15s,background .15s}
.rv{position:relative}
.rv .rreset{position:absolute;right:calc(100% + 8px);top:50%;transform:translateY(-50%)}
.rreset .ri,.wifall .ri{font-size:13px;line-height:1}
.rreset .rlive{font-family:var(--mono);font-weight:600;font-size:11px}
.rreset:hover{border-color:var(--ink2);background:var(--inset)}
/* the page says when it is showing a hypothetical, in the moved values' amber, with one
   way back for all of them - it stands where the tap hint does while anything is moved */
.wifnote{display:inline-flex;align-items:center;gap:8px;font-family:var(--sans);font-size:11.5px;color:var(--ink2);min-width:0}
.wiftag{font-style:normal;font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--hot);
border:1px solid var(--hot);border-radius:99px;padding:3px 8px;line-height:1;white-space:nowrap}
.wifall{height:24px;padding:0 10px 0 8px;border:1px solid var(--hot);border-radius:99px;background:transparent;color:var(--hot);
font-family:var(--sans);font-size:11.5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.wifall:hover{background:var(--card2)}
.wifall:focus-visible{outline:2px solid var(--hot);outline-offset:2px}
@media(max-width:620px){#wifn{display:none}}
.rreset:focus-visible{outline:2px solid var(--hot);outline-offset:2px}
.wrow.dirty .rreset{visibility:visible;opacity:1}
/* the row's label IS the readout button: the disc, the name, the arrow that
   opens the card - one control where there used to be a box above the map and
   a caption down here saying the same thing */
/* the row title is plain text and the whole of it is the control: the disc,
   the words, nothing else - no box, no arrow. The same in all three rows. */
.rlab .etabox,.rlab .etabox:hover,.rlab .etabox.eta.rise,.rlab .etabox.eta.fall,.rlab .etabox.conc,
.rlab .etabox.conc.low,.rlab .etabox.cool,.rlab .etabox.eta.rise:hover,.rlab .etabox.eta.fall:hover,
.rlab .etabox.conc:hover,.rlab .etabox.conc.low:hover,.rlab .etabox.cool:hover{
font-size:9.5px;letter-spacing:.14em;padding:0;gap:7px;min-width:0;
border:0;background:transparent;box-shadow:none;color:var(--ink2);border-radius:0}
.rlab .etabox::after{content:none}
.rlab .etabox .sgoarr{color:var(--hot);margin-left:1px}
.rlab .etabox:hover .sgoarr{transform:translateX(3px)}
.rlab .etabox .eb{margin-right:0;transition:box-shadow .15s}
.rlab .etabox{color:var(--h,var(--ink2));text-decoration:underline dotted;text-decoration-color:currentColor;
text-underline-offset:3px;text-decoration-thickness:1px}
.rlab .etabox.eta{--h:#ffc65a}.rlab .etabox.eta.rise{--h:#7cf0a4}.rlab .etabox.eta.fall{--h:#ff9b7a}
.rlab .etabox.conc{--h:#ff9b7a}.rlab .etabox.conc.low{--h:#7cf0a4}.rlab .etabox.cool{--h:#8fe8e0}
.rlab .etabox:hover{color:var(--lit);text-decoration-style:solid}
.rlab .etabox:hover .eb{box-shadow:0 0 0 1.5px #0b0b16,0 0 0 3px var(--h),0 0 9px var(--g)}
.rlab .etabox:focus-visible{outline:2px solid var(--hot);outline-offset:3px}
.rlab{display:flex;justify-content:space-between;align-items:center;font-family:var(--mono);
font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);margin-bottom:8px}
.wrow .rlab{margin:8px 0 0}   /* the track above, the title under it: the LIVE labels hang between them */
.wrow .trackwrap{margin-top:14px}   /* room over the track for the trip label; the same in all three rows */
.rval{font-size:14px;color:var(--ink);letter-spacing:0;text-transform:none;
font-variant-numeric:tabular-nums;transition:color .2s}
.wrow.dirty .rval{color:var(--hot)}
.wrow{padding-bottom:22px}
.tick{position:absolute;top:50%;width:1.5px;height:16px;transform:translate(-50%,-50%);
background:#fff;pointer-events:none;z-index:1;opacity:.9}
.tick::after{content:attr(data-l);position:absolute;top:17px;left:50%;transform:translateX(-50%);
font-family:var(--mono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;
color:var(--ink2);white-space:nowrap}
/* the trip mark: the one preset worth keeping, so it is drawn taller than the
   live tick and its label sits ABOVE the track, where nothing else is */
.tick.trip{background:var(--burn);height:22px;width:2px;opacity:1;box-shadow:0 0 5px #ff4d1f99}
.tick.trip::after{top:auto;bottom:21px;color:var(--burn);font-size:9.5px;letter-spacing:.1em;font-weight:700;text-transform:none;
opacity:1;white-space:nowrap;background:#0b0b16;padding:1px 4px;border:1px solid #ff4d1f66;border-radius:3px}
.wrow.dirty .tick.live{opacity:1;box-shadow:0 0 6px #fff9}
@media(max-width:620px){.wrow{padding-bottom:20px}}
.duo{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-items:stretch}
.duo .sec{justify-content:center}
@media(max-width:1000px){.duo{grid-template-columns:1fr 1fr}}
@media(max-width:700px){.duo{grid-template-columns:1fr}}

/* the headline value of a section */

/* the dim-to-lit ramp IS the track: the thing you drag is the thing it describes */
/* input[type=range] is element+attribute (0,1,1) and outranks a bare class,
   so the 340px cap from the base rule kept winning. Match it and add. */
input[type=range].gradrange{-webkit-appearance:none;appearance:none;width:100%;max-width:none;min-width:0;
height:10px;border-radius:3px;outline:none;flex:0 0 auto;cursor:pointer;margin:1px 0 2px}
/* The native thumb keeps the drag and the hit area but is drawn invisible; the
   visible knob is an overlay, because a real thumb cannot contain text. It is
   pointer-events:none so every gesture still lands on the input underneath. */
input[type=range].gradrange::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;
border-radius:50%;background:transparent;border:none;cursor:grab}
input[type=range].gradrange::-moz-range-thumb{width:24px;height:24px;border-radius:50%;
background:transparent;border:none;cursor:grab}
input[type=range].gradrange:focus-visible{box-shadow:0 0 0 4px #ffb02e55}
.trackwrap{position:relative;display:flex;align-items:center;height:24px}
/* the track is a lit groove: the ramp (painted inline by app.js) sits in a
   recess with shade at its top edge and a hairline of light at its foot, and a
   gloss band lies over its upper half - a bar of glass, not a stripe of paint */
input[type=range].gradrange{box-shadow:inset 0 1px 0 #ffffff40,inset 0 -2px 3px #000000a0,
0 2px 4px #000000a0,0 5px 10px #00000060}
.trackwrap::before{content:"";position:absolute;left:0;right:0;top:50%;height:10px;margin-top:-5px;
border-radius:3px;pointer-events:none;z-index:1;
background:linear-gradient(180deg,#ffffff2e 0,#ffffff0a 45%,#00000000 55%,#00000040 100%)}

/* the staked track runs a cool ramp so it is never mistaken for the coefficient
   track above it; its handle and its button follow the same colour */
/* the three handles are one plain selector: the row's title already carries
   the lettered disc, so the handle carries nothing - a small pale knob with a
   dark rim, the same on every track, no glow to sit on the live label */
.knob .kg{display:none}
/* a stat cell that opens a panel: spans the grid, carries the arrow the other
   openers use, and is a real button so it keyboard-focuses like one */
.vstat.vfull{grid-column:1/-1}
/* the two halves of one rule, and a way into the panel that explains it */
.cgate{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:1px;
background:var(--edge);border:1px solid #ff6a3d4d;border-radius:8px;overflow:hidden;
cursor:pointer;position:relative;transition:border-color .15s}
.cgate:hover{border-color:#ff9b7a}
.cgate:focus-visible{outline:2px solid #ff9b7a;outline-offset:2px}
.cgate::after{content:"\2197";position:absolute;top:4px;right:7px;font-family:var(--mono);
font-size:9px;color:#ff9b7a;opacity:.75}
.cgate:hover::after{opacity:1}
.vstat.rdg{align-items:center;text-align:center;gap:0;padding-top:15px;padding-bottom:16px}
/* each row carries its own small caption the same distance above it, so the
   three read as one column of labelled facts: the amount, who moves, the result */
.rdgp{display:flex;flex-direction:column;align-items:center;gap:3px;width:100%}
.rdgc{font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:#7a78a3;
line-height:1;text-align:center}
.vstat.rdg .vv{color:var(--burn);font-size:19px;letter-spacing:-.02em}
/* a three-column grid so the arrow lands on the centre line whatever the two
   labels say - centring the whole string only centres the string */
.rdgf{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:9px;
width:100%;max-width:290px;font-family:var(--mono);font-size:9px;letter-spacing:.14em;
text-transform:uppercase;color:var(--ink3)}
.rdgf i{font-style:normal}
.rdgf i:first-of-type{text-align:right}
.rdgf i:last-of-type{text-align:left}
.rdgf em{font-style:normal;color:var(--burn);font-size:12px}
/* both rails share one inset panel: the amount, then what moves where, then what
   it lands on - one statement rather than three loose lines */
.rdgbox{width:100%;max-width:320px;margin-top:0;background:#0b0b16;
border:1px solid var(--edge2);border-radius:10px;padding:10px 12px 11px;
display:flex;flex-direction:column;gap:10px}
.rdgbox .rdgf{margin:0;width:100%;max-width:none;color:var(--ink2)}
.rdgv{font-family:var(--mono);font-size:19px;color:var(--burn);letter-spacing:-.02em;
font-variant-numeric:tabular-nums;text-align:center;line-height:1.1}
.rdgr i.to{color:var(--lit);font-size:13.5px}
/* the resulting concentration, on the same rail as the two thirds above it, so
   its arrow sits on the same vertical line as theirs */
.rdgr{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:9px;
font-family:var(--mono);font-size:12.5px;color:var(--burn);letter-spacing:-.01em;
margin-top:0;width:100%;max-width:none}
.rdgr i{font-style:normal}
.rdgr i:first-of-type{text-align:right}
.rdgr i:last-of-type{text-align:left}
.rdgr em{font-style:normal;font-size:12px;opacity:.85}
/* opposite the title, so the card offers the schedule without spending a slot
   in the control row for it */
/* a popup title set as a pill rather than a heading: the card already announces
   itself by opening, so the name reads better as a label on the panel than as a
   masthead, and the figure can ride inside the same pill as the symbol */
.ptag{display:inline-flex;align-items:center;gap:9px;font-family:var(--mono);
font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:400;
padding:7px 15px;border-radius:99px;line-height:1;white-space:nowrap}
.ptag i{font-style:normal;font-size:14px;letter-spacing:0}
.ptag b{font-weight:400;font-size:16px;letter-spacing:-.02em;color:var(--lit)}
.ptag.tc{color:#ff9b7a;background:#ff6a3d14;border:1px solid #ff6a3d4d;
box-shadow:0 0 18px -6px #ff4d1f66}
.ptag.te{color:var(--hot);background:#ffb02e14;border:1px solid #ffb02e4d;
box-shadow:0 0 18px -6px #ffb02e66}
.ptag.te i{color:var(--hot)}
.ptag.ts{color:#8fe8e0;background:#57d9d014;border:1px solid #57d9d04d;
box-shadow:0 0 18px -6px #57d9d066}
@media(max-width:620px){.ptag{font-size:10.5px;padding:6px 13px;gap:7px}
  .ptag b{font-size:15px}.ptag i{font-size:13px}}
/* a projection, not a fact: the label and figure sit in the cooler indigo the
   page uses for "not yet", and the date trails quietly after the value */
/* a projection reads quieter than the facts around it: label in the muted ink
   every other label uses, value in cream rather than an accent, date quieter
   still - nothing here has happened yet */
.vstat.proj .vk{color:var(--ink3)}
.vstat.proj .vv{color:var(--lit)}
.pdate{font-style:normal;color:#6f6d94;font-size:.78em;margin-left:8px;letter-spacing:.06em}
/* the halting set gets the same red outline the first cells of the map wear, so
   the figure and the blocks it refers to are recognisably the same thing */
.haltn{display:inline-flex;align-items:center;justify-content:center;min-width:1.9em;
padding:2px 5px;font-weight:400;color:var(--burn);border:1.5px solid var(--burn);
border-radius:3px;box-shadow:0 0 10px #ff4d1f44;line-height:1.15}
/* count and share were one run of text and read as a single number; the share is
   now smaller, cooler and set on its own line */
.vsubn{display:block;margin-top:3px;font-style:normal;font-size:10.5px;color:#8d86c9;
letter-spacing:.06em}
.vv .pc{display:block;margin-top:3px;font-style:normal;font-size:11px;
color:var(--ink3);letter-spacing:.08em}
/* a reading in the button row, deliberately inert - it opens nothing */

/* bullets: the three things worth knowing before any of the numbers */
/* three short facts, set quieter and tighter than body copy: they are reference
   lines to scan, not a paragraph to read */
.bul{margin:0;padding:14px 28px 16px;border-top:1px solid #2b2b4a;
font-size:11.5px;line-height:1.5;color:var(--ink3);list-style:none;
display:flex;flex-direction:column;gap:7px}
.bul li{position:relative;padding-left:15px}
.bul li::before{content:"";position:absolute;left:0;top:.52em;width:5px;height:5px;
border-radius:50%;background:var(--hot);opacity:.7}
.bul b{color:var(--ink2);font-weight:400}
.bul b.hotc{color:var(--burn)}
/* a bracketed phrase that carries a live figure on hover: dotted, a question
   cursor, and the figure itself in a tip that follows the pointer */
.bul b.hov{color:var(--ink2);text-decoration:underline dotted;text-underline-offset:3px;cursor:help;position:relative}
.bul b.hov:hover{color:var(--lit)}
.bul b.hov::after{content:attr(data-tip);position:absolute;left:0;bottom:calc(100% + 6px);white-space:nowrap;
font-family:var(--mono);font-size:10px;letter-spacing:.04em;color:var(--lit);background:#0d0d1a;border:1px solid var(--edge2);
border-radius:6px;padding:5px 9px;box-shadow:0 10px 24px -8px #000;opacity:0;transform:translateY(3px);pointer-events:none;
transition:opacity .15s,transform .15s}
.bul b.hov:hover::after,.bul b.hov:focus::after{opacity:1;transform:none}
#meanhov::after{left:auto;right:0}   /* it sits at the line's end: the tip opens leftward, inside the card */
.bul.bul2{border-top:0}                 /* the boxes above already draw the rule */
.sc{font-variant:small-caps}
b.hotc{color:var(--burn);font-weight:inherit}
/* the concentration block, folded into this card rather than a panel of its own */

@media(max-width:620px){
  .bul{padding:11px 16px 12px;font-size:10.5px;gap:6px}
  
}
.vstat.vfull .vv{color:var(--burn)}
.vstat.vrow{grid-column:1/-1;position:relative;text-align:left;border:0;cursor:pointer;
font-family:inherit;background:#0e0e1c}
.vstat.vrow:hover{background:#16162a}
.vstat.vrow .vv{color:var(--burn)}
.vstat.vrow .vv i{font-style:normal;color:var(--ink3);font-size:.78em;margin-left:3px}
.vstat.vrow::after{content:"\2197";position:absolute;top:9px;right:14px;font-size:10px;
color:var(--burn);opacity:.8;font-family:var(--mono)}
.vstat.vrow:hover::after{opacity:1}
/* eta's own accent is its DIRECTION, not a fixed hue: green while the chain is
   concentrated enough to push it up, red while it is stepping back down. The
   same green the signing strip uses for a signed block. */
.etabox.eta.rise{border-color:#2ee06a55;background:#2ee06a0f;color:var(--ink3)}
.etabox.eta.rise b,.etabox.eta.rise::after{color:#5cf08f}
.etabox.eta.rise:hover{border-color:#5cf08f;background:#2ee06a1f}
.etabox.eta.rise:focus-visible{outline-color:#5cf08f}
.etabox.eta.fall{border-color:#ff4d1f55;background:#ff4d1f0f;color:var(--ink3)}
.etabox.eta.fall b,.etabox.eta.fall::after{color:#ff8a5c}
.etabox.eta.fall:hover{border-color:#ff8a5c;background:#ff4d1f1f}
.etabox.eta.fall:focus-visible{outline-color:#ff8a5c}

.etabox.conc{border-color:#ff6a3d55;background:#ff6a3d0f}
.etabox.conc b,.etabox.conc::after{color:#ff8a5c}
.etabox.conc:hover{border-color:#ff8a5c;background:#ff6a3d1f}
/* Concentration reads the opposite way round from the coefficient: under the
   threshold the set is spread out - the healthy side - so the box turns green
   there and keeps its salmon at 3.00x and above. Driven by the same flag that
   flips eta's box, so the two always agree about which side of the line we are
   on even though they colour it differently. */
.etabox.conc.low{border-color:#2ee06a55;background:#2ee06a0f}
.etabox.conc.low b,.etabox.conc.low::after{color:#5cf08f}
.etabox.conc.low:hover{border-color:#5cf08f;background:#2ee06a1f}
.etabox.conc.low:focus-visible{outline-color:#5cf08f}
.etabox.conc.low .disc.dc{color:#7cf0a4;border-color:#7cf0a4;
box-shadow:0 0 0 1.5px #0b0b16,0 0 9px #2ee06a88}

.etabox.cool{border-color:#57d9d055;background:#57d9d00f}
.etabox.cool b,.etabox.cool::after{color:#7fe5de}
.etabox.cool:hover{border-color:#7fe5de;background:#57d9d01f}
/* each handle carries its panel's colour - three near-white discs read as the
   same control repeated three times */
.knob{position:absolute;top:50%;left:0;transform:translate(-50%,-50%);
width:16px;height:16px;border-radius:50%;background:#efeaf8;
border:2px solid #0b0b16;box-sizing:border-box;
display:flex;align-items:center;justify-content:center;
pointer-events:none;box-shadow:0 0 0 1px #ffffff55,0 1px 2px #0008;z-index:2}
/* flex centres the line box, not the ink: a cap-height C or S sits low and the
   descender of eta sits high. Each glyph carries its own measured correction. */
/* the letters are drawn, not typed: three small paths whose ink is centred in
   their own box by construction, so no font on any device can push them off */
.kg{display:block;width:72%;height:72%;color:inherit}
/* label and figure on one line at one size, the way the Range header reads;
   only the colour separates them */
/* label and figure sit together over the buttons they belong to, and the figure
   is amber because it MOVES with those buttons the way the coefficient does */

/* the same tag the coefficient wears over the grid, so the two readings on this
   panel read as the same kind of thing */
/* No box and no tint: a border plus a fill is a button, and this is a reading.
   Brightness comes from the figure itself rather than from a frame around it. */

/* the coefficient the map is drawn at, sized like the mode buttons opposite */
/* Same family as the mode buttons opposite, but this one opens a panel rather
   than switching a view, so it carries the corner arrow that convention reserves
   for "this opens something" - plus an amber tint to set it apart from the
   three neutral toggles. */
.etabox{position:relative;font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;
text-transform:uppercase;color:var(--ink3);border:1px solid #ffb02e55;background:#ffb02e0f;
border-radius:3px;padding:4px 17px 4px 9px;display:inline-flex;align-items:center;gap:6px;
cursor:pointer;font-variant-numeric:tabular-nums}

/* the three readouts wear the tiles' prism material: a light catch top-left,
   a rim, shade toward the bottom-right, a shallow drop off the frame */
.frow .etabox.eta,.frow .etabox.conc,.frow .etabox.cool{
box-shadow:inset 0 -1px 0 rgba(0,0,0,.5),0 1px 3px rgba(0,0,0,.6)}
.frow .etabox.eta.rise{background-color:#0c2416}
.frow .etabox.eta.fall{background-color:#24100a}
.frow .etabox.conc{background-color:#24110c}
.frow .etabox.conc.low{background-color:#0c2416}
.frow .etabox.cool{background-color:#0a2024}
.etabox::after{content:"\2197";position:absolute;top:2px;right:4px;font-size:8.5px;
line-height:1;color:var(--hot);opacity:.75}
.etabox:hover{border-color:var(--hot);background:#ffb02e1f;color:var(--ink2)}
.etabox:hover::after{opacity:1}
.etabox:focus-visible{outline:2px solid var(--hot);outline-offset:2px}

.etabox b{font-size:11px;font-weight:400;color:var(--hot);letter-spacing:-.02em;
font-variant-numeric:tabular-nums}

/* one row of equal buttons, centred under the track */

/* the range row spans the full width, so its buttons stretched to twice the
   size of the paired sections' - cap them instead of letting flex fill */

.apx{font-family:var(--mono);font-size:8px;letter-spacing:.14em;color:var(--ink2);
text-transform:uppercase;white-space:nowrap}
.apx b{font-size:10.5px;color:var(--hot);font-weight:400;letter-spacing:-.01em}
.apxsub{font-family:var(--mono);font-size:8px;letter-spacing:.2em;text-transform:uppercase;
color:var(--ink2);margin-top:-2px}
@media(max-width:620px){
  /* both tags share the second line: the title claims the first, and the tags
     shrink rather than break apart from one another */
  .tag{font-size:6.5px;padding:2px 5px;letter-spacing:.03em;gap:4px;min-width:0}
  /* the two readouts sit together on the left rather than being pushed apart by
     space-between, and the six view buttons share one row across the section */
  .frow{gap:7px;}
  .modes{margin-left:0;flex:1 0 100%;}
  .mbtn{flex:1 1 0;min-width:0;
  text-align:center;white-space:nowrap}
  .etabox{font-size:9px;padding:3px 17px 3px 7px}
  .etabox b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .etabox b{font-size:10px}
  .etabox::after{font-size:7.5px;top:2px;right:3px}
  /* one row on a phone: mark, title and the halt tag together, all centred on
     each other. The title no longer claims a full line of its own - there is no
     slogan under it any more, so nothing has to wrap. */
  .bt{gap:3px 6px;flex-wrap:nowrap}
  .btx{flex:0 1 auto;min-width:0}
  
  .bt .tag{flex:0 0 auto}
  .sec{padding:13px 13px 12px;gap:9px}

.apx{font-size:8px;white-space:normal;text-align:center}
  .apx b{font-size:12px}
  }

/* ── popups, refined ───────────────────────────────────────────────────────
   Everything below is presentation only: same markup, same ids. The cards were
   flat panels on a flat scrim, which read as a debug overlay rather than
   something composed. */
.pop{background:#04040acc;backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
.pop .card{
  border-radius:12px;
  border:1px solid #3a3a63;
  background:linear-gradient(180deg,#12121f 0,#0a0a13 320px);
  box-shadow:0 34px 90px -28px #000,0 0 0 1px #00000066,
             inset 0 1px 0 #ffffff12;
}
.pop.on .card{animation:popin .22s cubic-bezier(.2,.7,.3,1) both}
.pop.on.back .card{animation:none}
@keyframes popin{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.pop.on .card{animation:none}}

/* header: more air, clearer hierarchy */
.vhead{padding:24px 28px 20px;
background:linear-gradient(180deg,#191930 0,#0d0d18 100%);
border-bottom:1px solid #2b2b4a}
.vname{letter-spacing:-.025em}

.vlogo,.vmono{box-shadow:0 0 0 1px #ffffff1a,0 6px 18px -8px #000}

/* the figure grid: hairlines instead of slabs, and room to breathe */
.vgrid{background:#2b2b4a;gap:1px;border-top:1px solid #2b2b4a;margin-top:20px}
#vpop .vgrid{border-bottom:1px solid #2b2b4a}
/* nothing sits between the header and the figures here, so the gap read as an
   empty row */
#spop .vgrid,#vpop .vgrid,#cpop .vgrid{margin-top:0;border-top:none}
.vgrid.gbelow{margin-top:14px;border-bottom:1px solid var(--edge)}
/* the formula sits right above the figures now, so it needs its own breathing
   room rather than a margin on the grid */

#qpop .vgrid{margin-top:0}
/* the coefficient and concentration cards must fit a laptop viewport without a
   scrollbar of their own: tighter cells and lists than the validator card */
#qpop .vstat,#cpop .vstat{padding:10px 20px 11px;gap:5px}
#qpop .bul,#cpop .bul{padding:10px 24px 12px}
#qpop .vgrid.gbelow{margin-top:8px}

#cpop .cband{padding-top:10px;padding-bottom:10px}
#qpop .card,#cpop .card{max-height:96vh;max-height:96svh}

.vstat{background:#0b0b16;padding:14px 28px 15px;gap:7px;transition:background .15s}
.vstat:hover{background:#12121f}
.vk{font-size:8.5px;letter-spacing:.2em;color:#7a78a3}
.vv{font-size:15.5px;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vstat.hot .vv{color:var(--hot)}

.vnote{font-size:11.5px;line-height:1.6;color:#6f6d94;padding:12px 24px 15px;
border-top:1px solid var(--edge);margin-top:0;text-align:center}
.badge{border-radius:99px;padding:4px 11px;letter-spacing:.14em}
.vbadges{padding:18px 28px 0;gap:8px}

@media(max-width:620px){
  .pop .card{border-radius:10px}

.vnote{padding:15px 18px 19px}
  
}

/* ── phone: leave the fold some air ────────────────────────────────────────
   Everything fitted, but exactly: at 390x844 the fold measured 803px against a
   757px viewport, so it was overflowing rather than sitting comfortably. This
   claws back roughly a hundred pixels from padding and gaps instead of shrinking
   the grid, which is the one element that must stay tappable. */
@media(max-width:620px){
  .fold{gap:7px;padding:7px 0 9px}
  /* A 10-wide grid of square cells wants its full width back as height, which
     pushed the stake range off the bottom of a phone once C got its own section.
     The map gives the room back by flattening its rows, NOT by narrowing: a
     narrower map stops sharing an edge with the buttons and the APR bar above
     and below it, and the whole section reads as broken. Tiles stay the size
     they were; they just span the full width now. */
  .cell{aspect-ratio:auto}
  .grid{grid-auto-rows:1fr;height:100%}
  #gwrap{height:var(--maph,307px)}          /* 10 rows x 22px + 9 gaps x 3px, exactly */
  /* a tile is no longer square, so the avatar has to hold its own circle */
  .cell img{inset:auto;left:50%;top:50%;width:auto;height:76%;aspect-ratio:1;
    transform:translate(-50%,-50%)}
}
/* shorter phones: the map keeps giving, since it is still the tallest block and
   the home pane has to clear the tab bar on an SE as well as a Pro Max */
@media(max-width:620px) and (max-height:780px){
  #gwrap{height:var(--maph,287px)}
  .fold{gap:6px}
}
@media(max-width:620px) and (max-height:720px){
  #gwrap{height:var(--maph,237px)}
  .sec.tight{padding:7px 11px;gap:5px}
}
/* when even the map's floor cannot make Home fit, Home scrolls inside the window
   rather than losing its last row off the screen */
@media(max-width:620px) and (max-height:700px){#p-home{overflow-y:auto;overscroll-behavior:contain}}
@media(max-width:620px) and (max-height:640px){
  #gwrap{height:var(--maph,197px)}
  
}
@media(max-width:620px){
  
  .grid{gap:3px}
  .duo{gap:7px}
  .sec.tight{padding:8px 12px;gap:6px}
  .frow{margin-bottom:3px}
  .trackwrap{height:22px}
  .knob{width:15px;height:15px}

.aprbar{gap:8px}
  .apnum{font-size:16px}

}

/* ── popup header, made identical for every validator ──────────────────────
   Name length, rank width and description length all varied, so no two cards
   sat the same way. Fixed mark, fixed two-line description slot, rank as a
   chip on the name's baseline - the header is now the same shape whoever you
   tap. Sizes are capped so a card never fills the screen and there is always
   somewhere to tap to dismiss it. */
.vhead{align-items:flex-start;gap:15px}
/* top-alignment exists so a two-line description lines up with the mark; this
   card has no description, so a single line must centre against it instead */
#spop .vhead,#cpop .vhead,#qpop .vhead{align-items:center}
#qpop .vhead{position:relative;}
#qpop .vhead .disc{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
width:24px;height:24px;font-size:13px}
#spop .vname,#cpop .vname,#qpop .vname{min-height:0}
#cpop .vgrid{margin-top:0;border-top:none}
.vlogo,.vmono{width:46px;height:46px}
.vmono{font-size:20px}
/* the mark and the name share the first line; the description and the link run
   the FULL width beneath both, so the column under the mark is never left blank.
   nowrap on the name keeps the rank beside it - a long moniker wraps inside its
   own span instead of pushing the chip onto a line of its own. */
/* the header gap spaces the mark from the name; applied to ROWS as well it
   pushed the site line 27px below the name and broke the tagline read */
.vwrap{flex-wrap:wrap;align-items:center;row-gap:0}
.vwrap .vlogo,.vwrap .vmono{flex:0 0 auto}
/* The action used to share this row, so a 31-character moniker was squeezed to
   nothing between it and the rank chip. The name and its rank own the line now;
   the action sits on the line below, opposite the site. */
.vname{display:flex;align-items:center;gap:9px;flex-wrap:nowrap;min-width:0;font-size:19px;
line-height:1.25;min-height:23px;min-width:0}
.vsub{display:flex;align-items:center;gap:10px;margin-top:4px;min-width:0}
.vsub .notify{margin-left:auto}
.vnm{min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* the site line is a tagline to the NAME, so it lives in the name's column and
   starts at the name's left edge - not full width under the mark */
.vcol{flex:1 1 0;min-width:0;display:flex;flex-direction:column}
.vrk{font-size:10px;color:var(--hot);border-color:#ffb02e55;background:#ffb02e12;
padding:2px 8px;margin-left:0;letter-spacing:.02em;line-height:1.5}

/* room to dismiss: a card that reaches the edges leaves nowhere to tap - on a phone a margin
   a thumb can find on every side; and the page behind never scrolls while a card is up (a
   drag on the scrim is not a scroll, a drag inside the card scrolls only the card) */
.pop{padding:28px 20px;touch-action:none;overscroll-behavior:contain}
.pop .card{overscroll-behavior:contain}
.pop .card:focus{outline:none}
html.popon,html.popon body{overflow:hidden}
.pop .card{max-height:84vh;max-height:84svh}
@media(max-width:620px){
  .pop{padding:28px 22px}
  .pop .card{max-height:80vh;max-height:80svh}
  .vhead{gap:12px}
  .vlogo,.vmono{width:40px;height:40px}
  .vmono{font-size:17px}
  .vname{font-size:16.5px;min-height:20px}
  .vrk{font-size:9px;padding:1px 7px}

}

/* the card measured 507px against a 488px cap at 360x700, so the last row was
   scrolling out of sight and reading as clipped; trim ~35px of padding rather
   than raise the cap, which exists to leave somewhere to tap */
@media(max-width:620px){
  .vhead{padding:14px 16px 13px}
  
  .aprband{padding:10px 16px}
  .aprbig{font-size:24px}
  .vstat{padding:9px 16px 10px}
  .vv{font-size:14px}
  .upsec{padding:12px 16px 15px;gap:10px}
  .upbars{height:15px}
  .upcell{padding:7px 8px}
  .upn{font-size:14px}
  .vbadges{padding:13px 16px 0}
}
@media(max-width:400px){
  .pop{padding:16px 10px}
  .vhead{padding:12px 14px 11px}
  .vstat{padding:8px 14px 9px}
  .upsec{padding:10px 14px 13px;gap:8px}
  .aprband{padding:9px 14px}
}
/* ── the hub sections, the wallet and the descent language (moved into the head:
   a sheet in the body let the bar paint unstyled for a frame on every reload) ── */
/* ── the tabbed half of the page ──────────────────────────────────────────────
   One screen, never a scroll: a collapsible rail on the desktop (the GATA app's
   idiom - icon chip, accent tint bleeding right, a bar on the active edge) and
   a Keplr-style bottom bar on a phone. The rail is the last flex child there,
   so it lands at the foot of the viewport without being position:fixed over
   the fold above it. */
/* Desktop: a header strip with the title on the left and the tabs on the right,
   the panes below it. Phone keeps the bar at the foot of the screen, which is
   where a thumb is. One element, two placements. */
.below{height:100svh;min-height:100svh;display:flex;flex-direction:column;
border-top:1px solid var(--edge);overflow:hidden}
/* The page buttons sit in the title row, in the same style as the eta/C/S
   openers below them, and each one swaps what fills the screen underneath. */
.brandbar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;
--tfs:clamp(17px,2vw,26px);padding:4px 0 2px}

/* auto side margins cancel stretch in a column flex container, so the wrapper
   was sizing to its content and squeezing the title row */
.panes>.w{width:100%}
.tabs{display:flex;margin-left:auto;}

@media(max-width:620px){
  .brandbar{gap:9px;padding:2px 0 0}
  
  .tabs{width:100%;margin:2px 0 0;}
  
}
/* One fixed frame for every tab: the header sits on top, the pane below fills
   whatever is left and centres its own content. Switching tabs swaps what is in
   the frame and moves nothing around it. */
.panes{flex:1 1 auto;min-width:0;min-height:0;overflow-y:auto;display:flex;
flex-direction:column;justify-content:center;padding:16px 34px 18px}
/* ── the calculator shell ─────────────────────────────────────────────────────
   Everything the app does today - the title row, the three page buttons and
   whichever page is open - is one bordered section, drawn the way the map and
   the range controls inside it are drawn. It reads as one instrument rather than
   as a page, which is what lets the rings around it later be separate
   instruments rather than more of the same page. The frame inside is unchanged:
   frame() measures the room that is actually left, so the border and the padding
   are absorbed automatically. */
.panes>.w{display:flex;flex-direction:column;flex:0 1 auto;min-height:0;gap:8px;
position:relative;border:1px solid var(--edge2);border-radius:12px;
padding:11px 13px 13px;background:linear-gradient(180deg,#0e0e1e 0,#0a0a14 100%)}
/* the plate on the box, riding its bottom edge */
.calclab{position:absolute;left:20px;bottom:-6px;padding:0 8px;background:var(--void);
font-family:var(--mono);font-size:8.5px;letter-spacing:.24em;text-transform:uppercase;
color:var(--ink3);pointer-events:none}
@media(max-width:620px){.calclab{left:14px;font-size:7.5px;letter-spacing:.18em;padding:0 6px}}
.brandbar{flex:0 0 auto}
@media(min-width:621px){.brandbar{height:52px;padding:0}}
.pane{display:none;padding:0;border:0}
/* visibility is driven by an attribute on <html>, which the head script can set
   before the body is parsed; the .on class stays for the buttons */
html:not([data-tab]) #p-home,
html[data-tab=home] #p-home,html[data-tab=eta] #p-eta,
html[data-tab=pays] #p-pays,html[data-tab=empty] #p-empty,html[data-tab=connect] #p-connect,html[data-tab=dele] #p-dele,html[data-ui=simple][data-tab=dele] #sv,html[data-tab=intro] #p-intro{display:flex;
flex-direction:column;justify-content:flex-start;flex:0 0 auto;
height:var(--paneh,auto);min-height:0;
animation:panein .22s ease}
.pane>.pw,.pane>.w{width:100%}
/* Home is sized to what it needs; every other screen takes the room the window
   really has (frame() measures it as --roomh), so Picks, Manage and the
   placeholders never leave a dead band under clipped content */
html[data-tab=eta] #p-eta,html[data-tab=pays] #p-pays,html[data-tab=empty] #p-empty,html[data-tab=connect] #p-connect,
html[data-tab=dele] #p-dele,html[data-tab=dele] #sv,html[data-tab=intro] #p-intro{height:var(--roomh,var(--paneh,auto))}
.pane>.pw{height:100%;min-height:0;display:flex;flex-direction:column}
.pane>.pw>.duo2{flex:1 1 auto;min-height:0}

@keyframes panein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.pw{max-width:none;margin:0;width:100%}
/* Two panels side by side: the schedule and the measurement of whether it is
   working belong together, and on their own each was a chart floating in space.
   Borders give the page the same structure the map gives Home. */
.duo2{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:stretch;height:100%}
.panel{border:1px solid var(--edge2);border-radius:9px;background:var(--card);
padding:12px 15px 14px;min-width:0;display:flex;flex-direction:column;min-height:0;
overflow:hidden}
.ptitle{font-size:13px;letter-spacing:-.01em;color:var(--lit);font-weight:700;
margin-bottom:4px;line-height:1.2}
.panel .sub{color:var(--ink3)}
.pane .panel .sub{margin-top:3px;font-size:11px;line-height:1.45}
.pane .panel .note{font-size:10.5px;margin-top:7px}
.panel svg[viewBox]{flex:0 0 auto;height:42%;min-height:80px;max-height:none;margin:8px 0 4px}
.panel .sbox{margin-top:8px;grid-template-columns:1fr 1fr}
.panel .sbox .v{font-size:clamp(13px,1.15vw,15px);line-height:1.1}
.panel .sbox .k{font-size:8.5px;margin-top:5px;letter-spacing:.12em}
.panel .sbox .s{font-size:10px;margin-top:3px}
.panel .sbox>*{padding:6px 9px;text-align:center}

.panel .sbox.mv{margin-top:8px}

@media(max-width:620px){
  /* A grid row's automatic minimum is min-content, so "auto 1fr" rows refused to
     shrink and .panel's overflow:hidden ate the boxes at the bottom. */
  .duo2{grid-template-columns:1fr;
    }
  /* The chart takes whatever is left after the text and the boxes, instead of
     holding a fixed share of the panel and pushing the boxes out of it. */
  
  .panel{padding:9px 11px 10px}
  /* the small line now carries which period the box is, so it stays */
  
  .panel .sbox>*{padding:7px 9px}
  .panel .sbox .v{font-size:16px}
  .panel .sbox .k{font-size:8.5px;margin-top:4px}
  .panel .note{display:none}
  .panel .sub{font-size:10.5px}

}
/* one disc, three treatments - the same handles the range bars carry, reused on
   the button that opens a panel and again in that panel's corner, so the letter
   on the bar, the letter on the button and the letter on the card are one thing */
.disc{display:inline-grid;place-items:center;border-radius:50%;font-family:var(--mono);
font-weight:700;line-height:1;flex:0 0 auto;box-sizing:border-box}
.disc{background:#0e0c18;color:var(--h);border:1.5px solid var(--h);
box-shadow:0 0 0 1.5px #0b0b16,0 0 7px var(--g)}
.disc.de{--h:#ffc65a;--g:#ffb02e77}
/* the eta disc follows its box: green while the coefficient rises, red while
   it falls - the same signal C's disc gives either side of the threshold */
.etabox.eta.rise .disc.de{--h:#5cf08f;--g:#2ee06a66}
.etabox.eta.fall .disc.de{--h:#ff8a5c;--g:#ff4d1f66}
.disc.dc{--h:#ff9b7a;--g:#ff4d1f66}
.disc.ds{--h:#8fe8e0;--g:#57d9d066}
.disc i{font-style:normal}
.disc .kg{display:block;width:72%;height:72%}
/* a letter this small has no room to be approximately centred, so give it a
   little more circle to sit in; the disc is part of the button, never its own
   target, so it takes no pointer events of its own */
.eb{width:15px;height:15px;font-size:9px;margin-right:7px;pointer-events:none}
/* the halo belongs on the range handle, where there is room for it; at 15px it
   only made S read as a smaller circle than the two beside it */
.frow .etabox{flex:0 0 auto;min-width:106px;justify-content:flex-start}
@media(max-width:620px){.frow .etabox{min-width:0;flex:1 1 0}}
.ck{width:16px;height:16px;font-size:9px;opacity:.9}
@media(max-width:620px){
  .ck{width:15px;height:15px;font-size:8.5px}
}
/* the rail carries the colophon now, so the page itself never scrolls */
/* the fold is a pane now, so it stops claiming a screen of its own */
#p-home .fold{min-height:0;padding:0;gap:11px}
/* the title row costs the fold about forty pixels, and the desktop fold had no
   slack; take it back from the padding rather than from the map, which is the
   one thing on this screen people actually look at */

/* .panes supplies the gutter; .w supplying a second one squeezed the phone */
.pane .w{padding:0;max-width:none}
#p-home{width:100%}
/* the schedule's fourth box is a control, so it looks like one */
/* a cell that happens to be a button: same type as its neighbours, with the
   arrow sitting in the line it belongs to rather than floating in a corner */
.sgo{border:0;font:inherit;color:inherit;cursor:pointer;
text-align:left;margin:0;display:block;width:100%}
.sgo .v,.sgo .k,.sgo .s{transition:color .15s}
.sgo .s{color:var(--hot);opacity:.85}
.sgoarr{font-family:var(--mono);display:inline-block;transition:transform .15s}
.sgo:hover .v{color:var(--hot)}
.sgo:hover .s{opacity:1}
.sgo:hover .sgoarr{transform:translateX(3px)}
/* the weeks box in the coefficient card is the same kind of door as the
   schedule pane's today box: the whole box is the button, the arrow the hint */
#qpop .vstat.sgo{display:flex;text-align:center;font:inherit;width:auto}
#qpop .vstat.sgo .sgoarr{margin-left:4px}
#qpop .vstat.sgo:hover .vv{color:var(--hot)}
/* the page's table defaults right-align everything and left-align the first
   column; with a rank column in front, the moniker inherited the right edge and
   opened a gap next to its own number. The pays table states its own alignment. */
.ptw{border:1px solid var(--edge2);border-radius:9px;overflow:hidden;margin-top:16px;
background:#0b0b16}
.ptab{margin:0}
.ptab th{background:#0f0f1c;border-bottom:1px solid var(--edge2);padding:9px 13px;
text-align:right;font-size:9px;letter-spacing:.14em;color:var(--ink3)}
.ptab td{padding:10px 13px;text-align:right;border-bottom:1px solid #23234255}

.ptab th:first-child,.ptab td:first-child{text-align:left;width:1%;white-space:nowrap;
padding-right:4px}
.ptab th:nth-child(2),.ptab td:nth-child(2){text-align:left;padding-left:9px}
.ptab .rkc{color:#5c5a80;font-variant-numeric:tabular-nums;}
.ptab tr.vrow{cursor:pointer;transition:background .13s}
.ptab tr.vrow:hover td{color:var(--ink)}
.ptab tr.vrow:hover .nm{color:#fff}
.ptab tr.vrow:focus-visible{outline:2px solid var(--hot);outline-offset:-2px}
.ptab .nm{color:var(--lit);max-width:15ch;display:flex;align-items:center;gap:6px}
.ptab .nm span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.ptab .tlg{border-radius:50%;flex:0 0 auto;object-fit:cover;
background:#1b1b33;border:1px solid #ffffff14}
.ptab .tlgx{background:#16162c}
/* the last column was landing on the frame: the page's own td rule sets a zero
   left pad and the phone override shaved the right one to nothing */
.ptab th:last-child,.ptab td:last-child{padding-right:13px}
#trend{cursor:zoom-in}
/* big enough to read thirty-three weekly points, not so big it replaces the
   page behind it: a panel, like every other popup, just a wider one */
.pop .card.vcard.gcard{max-width:min(90vw,1080px)}
.gcard #trendbig{max-height:min(58vh,420px)}
.gcard #trendbig{width:100%;height:auto;display:block;touch-action:none;
background:#0b0b16;border-top:1px solid var(--edge);border-bottom:1px solid var(--edge)}
.gcard .vnote{padding:11px 22px 16px}

.ptab .ok{color:#5cf08f}

.duotab{display:grid;grid-template-columns:repeat(3,1fr);
height:100%;min-height:0}
.pane>.pw>.duotab{flex:1 1 auto}
.duotab>div{display:flex;flex-direction:column;min-height:0}
.duotab .ptw{flex:1 1 auto;min-height:0;overflow-y:auto;
scrollbar-color:var(--edge2) #0b0b16;scrollbar-width:thin}
.duotab .ptw::-webkit-scrollbar{width:7px}
.duotab .ptw::-webkit-scrollbar-thumb{background:var(--edge2);border-radius:4px}
.ptab thead th{position:sticky;top:0;background:#0f0f1c;z-index:1}

.tcap i{font-style:normal;color:var(--ink3);opacity:.8}
.tcap{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink3);
margin:16px 0 -6px}
.tcap.good{color:#5cf08f}
@media(max-width:620px){

#p-pays .note{display:none}
  .tcap{margin:10px 0 -6px}
  .ptab th:last-child,.ptab td:last-child{padding-right:10px}
  .ptab .nm{max-width:11ch}
  
}
@media(max-width:620px){
  .ptw{margin-top:12px}
  .ptab th{padding:8px 8px;font-size:8.5px;letter-spacing:.08em}
  .ptab td{padding:7px 8px;font-size:11.5px}
}
/* these were written as sections you scrolled through; inside a pane they have
   one screen and must live in it, so the type scale is a step down from the
   fold's and everything keys off the viewport height rather than the width */
.pane h2{font-size:clamp(19px,2.1vw,26px);margin:8px 0 0}

.pane .sub{font-size:clamp(12px,1.05vw,14px);margin:7px 0 0;max-width:72ch}

.pane .sbox{margin-top:12px}
.pane .sbox .v{font-size:clamp(22px,2.4vw,30px)}

/* the page stacks these two at 760px, but they only mean anything side by side:
   the whole point is before against after, read in one glance */

@media(max-height:820px){
  
  .pane .sbox{margin-top:9px}
  .panes{padding:14px 34px}
}
@media(max-height:700px){
  
  .pane .note{display:none}
  
}
/* the charts scale to the pane instead of forcing a sideways drag */
.pane svg[viewBox]{width:100%;height:auto;display:block;margin:10px 0 2px;max-height:34vh}
.ptab{width:100%}
/* a placeholder row: the same height as a real one, nothing to click */
.ptab tr.phr td{color:var(--ink3,#6f6d94)}
.ptab tr.phr .phb{display:inline-block;width:55%;height:8px;border-radius:4px;background:rgba(255,255,255,.07);vertical-align:middle}
.ptab tr.phr .tlg{opacity:.35}
/* nothing lives under the tabs on a phone: the bar is the end of the page */
@media(max-width:620px){
  .below{flex-direction:column;min-height:100svh}
  .panes{padding:12px 20px 16px;justify-content:flex-start}
  .brandbar{height:74px}
  .pane svg[viewBox]{max-height:24vh}
}
/* ── phone: Home is the frame, the other two scroll inside it ───────────────
   Compressing Trend and Picks into Home's height made the charts unreadable and
   still clipped the last boxes. They keep the same frame - so the page does not
   resize when you switch tabs - and scroll within it. Home never scrolls: it is
   the thing every other page is measured against. */
@media(max-width:620px){
  #p-eta,#p-pays,#p-empty,#p-connect,#p-dele{overflow-y:auto;overscroll-behavior:contain}
  #p-eta>.pw,#p-pays>.pw{height:auto;min-height:100%}
  .duo2{grid-template-rows:auto auto;height:auto;gap:10px}
  #p-eta>.pw>.duo2,#p-pays>.pw>.duotab{flex:0 0 auto}
  .panel{overflow:visible}
  .panel svg[viewBox]{flex:0 0 auto;height:auto;min-height:0;margin:6px 0 4px}
  .panel .sbox .s{display:block;font-size:9px;margin-top:2px}
  .duotab{grid-template-columns:1fr;grid-auto-rows:auto;height:auto;}
  .duotab>div{min-height:0}
  .duotab .ptw{flex:0 0 auto;overflow-y:auto;max-height:200px}
}

/* ── the calculator's dark mode ───────────────────────────────────────────────
   Scoped to the calculator (#p-home and its cards): the rest of the app keeps
   its midnight palette. Modelled on the GATA app's "interstellar" theme - true
   black, panels a hair above black, hairline greys, soft white type that does
   not vibrate, and the accents pulled to greys - rather than a line drawing.
   Two inks stay: green for good, red for bad. The map keeps magnitude in grey. */

/* 1. every filled surface -> black */

/* the 1px gap-fills are the grid lines */
         /* the tab tint is set inline */

/* 2. tinted buttons, chips and tags -> hollow: white line, white type */

/* the two permitted inks: green is good, red is bad */

/* 3. pressed states: the one permitted fill, inverted */

/* 4. discs and handles: hollow rings, no glow */

/* 5. the inline styles nothing else can beat */

/* 6. status strips */
@media(max-height:720px){#vpop .vstat{padding:8px 20px 9px;gap:4px}#vpop .upsec{padding:11px 24px 12px;gap:8px}
#vpop .vhead{padding-top:16px;padding-bottom:12px}#vpop .aprband{padding-top:8px;padding-bottom:8px}#vpop .vbadges{padding-top:8px}}
/* the switch itself */

/* the switch shows what a press would give: a grey dot while the calculator is
   in colour, a coloured dot while it is grey */

/* ── the folder. Above 1100px the page is one document: a lip with the mark
   and the live line, then three folder tabs on the top edge of the window, the
   open one joined to it - same fill, no seam - and the window itself filling
   the rest of the screen edge to edge. Nothing floats, nothing is centred in
   empty space; sections are what you flip to, not where you go. */
.folder{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);grid-template-areas:"brand nav right";align-items:center;gap:16px;padding:0 28px;flex:0 0 auto;position:relative;z-index:2;height:46px;
border-bottom:1px solid var(--edge);}
/* the brand: mark and wordmark on one optical centre line */
.brand{display:flex;align-items:center;gap:10px;flex:0 0 auto;margin:0;grid-area:brand;justify-self:start;text-decoration:none;color:inherit}
.brand .mark{width:28px;height:28px;display:block;flex:0 0 auto}
.wordmark{font-size:18px;font-weight:800;letter-spacing:-.03em;color:var(--ink);line-height:1;display:block;}
/* the sections as words in the bar, the open one underlined by a light that
   glides to the next (#ind, one element moved by state()) */

/* the brand is the way home */
.brand{cursor:pointer;border-radius:8px;transition:opacity .2s}
.brand:hover{opacity:.85}
.brand:focus-visible{outline:2px solid var(--cyan);outline-offset:4px}
/* home: one sentence in the middle of the room, and two doors */
#p-intro>.w{padding:0;max-width:none;display:flex;flex-direction:column;height:100%;min-height:0}
.intro{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 24px 8vh;position:relative}
.intro::before{content:"";position:absolute;left:50%;top:50%;width:min(70vw,900px);height:min(50vh,420px);transform:translate(-50%,-56%);pointer-events:none;
background:radial-gradient(closest-side,rgba(255,176,46,.10),rgba(98,217,255,.05) 55%,transparent 75%);filter:blur(12px)}
.intro h1{position:relative;margin:0;font-size:clamp(30px,4.6vw,58px);font-weight:800;letter-spacing:-.035em;line-height:1.05;color:var(--ink);max-width:16ch;text-wrap:balance}
.intro h1 em{font-style:normal;background:linear-gradient(92deg,#ffd07a 0%,#ffb02e 35%,#62d9ff 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.intro p{position:relative;margin:22px 0 0;font-size:clamp(14px,1.35vw,17.5px);line-height:1.55;color:var(--ink2);max-width:52ch;text-wrap:balance}
/* My wallet: a chip in the bar - a mark and a word, framed; lit in cyan once you are in */

@media(max-width:620px){.brand{margin-right:16px;gap:8px}.brand .mark{width:28px;height:28px}
.wordmark{display:none}}
@media(min-width:1100px){
  .below{border-top:0;padding:0;background:var(--void)}
  /* no window: the bar on top, the section straight on the page ground */
  .panes{flex:1 1 auto;min-height:0;padding:22px 28px 0;margin:0;border:0;border-radius:0;overflow:hidden;
  background:transparent;position:relative;justify-content:flex-start;box-shadow:none}
  .w#calc{max-width:none;padding:0;margin:0;border:0;background:transparent;box-shadow:none}
  /* the window's inner column fills the window, so a section that hides the
     calculator's title row gets that row's height back instead of a dead band */
  .w#calc{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
  html[data-tab=empty] #p-empty,html[data-tab=connect] #p-connect,html[data-tab=dele] #p-dele,html[data-tab=dele] #sv,html[data-tab=intro] #p-intro{height:auto;flex:1 1 auto}
  
  .w#calc>.flipbox,.w#calc>#p-dele{padding:0}
  .w#calc>#p-empty,.w#calc>#p-connect,.w#calc>#p-intro{padding:0}
  .calclab{display:none}
  /* the window is full width now, so the map is taller than a short screen
     allows: let the fit loop's --maph govern it, as it does on a phone, with
     the tiles giving up their square rather than the sections their place */
  #gwrap{aspect-ratio:auto;height:var(--maph,auto);min-height:120px}
  #gwrap:not([style*="--maph"]){aspect-ratio:4/1}
  html[style*="--maph"] .cell{aspect-ratio:auto}
  html[style*="--maph"] .grid{grid-auto-rows:1fr;height:100%}   /* full width; the tiles flatten, never the map narrows */
  html[style*="--maph"] .cell img{inset:auto;left:50%;top:50%;width:auto;height:76%;aspect-ratio:1;transform:translate(-50%,-50%)}
}
/* the tabs and the Manage pill belong to Staking's front face only */

/* Governance is Staking's twin: the calculator's own title row and pill tabs
   (disabled until built), in the calculator's tokens, then one box saying soon */

/* the calculator's own title row belongs to Staking; the other sections bring theirs */
html[data-tab=intro] .w#calc>.brandbar,html[data-tab=intro] .flipbox{display:none}
html[data-tab=dele] .flipbox,html[data-tab=empty] .flipbox,html[data-tab=connect] .flipbox{position:absolute;left:0;right:0;top:70px;visibility:hidden;pointer-events:none}

/* ── the button families, renewed to the prism language: a glass group with
   one hairline, pills inside, the pressed one lit in its accent with a light
   catch and a soft glow - the same on the calculator tabs and the view row */
/* Bonus, Trend, Picks: the page's own tabs, in the bar's idiom - words on the
   title's baseline, the open one underlined in its own colour. Not a pill, and
   not part of the black-and-white mode: the mode is for the map and the cards,
   these three stay in colour whatever the switch says. */
.tabs{background:transparent;border:0;border-radius:0;padding:0;gap:26px;box-shadow:none;height:38px;align-items:stretch;flex-wrap:nowrap}

/* the etabox arrow does not belong on a tab */

.modes{background:#0b0b16;border:1px solid var(--edge2);gap:2px;
}
.mbtn{border:0;background:transparent;}
.mbtn:hover{background:#ffffff0a;color:var(--ink)}
.mbtn[aria-pressed=true]{background:linear-gradient(180deg,#ffd07a,#ffb02e);color:#140c00;
}
.nk{font-style:normal;color:var(--ink)}
/* Staking is a card with two faces: the chain's stake on the front, the
   reader's own on the back. Manage my stake turns it over; the header stays.
   Sections (the rail) do not flip - the frame fades to the next screen. */
/* the turn, gentled: the calculator settles back a step and dims, the
   reader's own stake slides in over it from the right; the reverse on the way
   back. Both faces stay in the tree so the motion is one continuous ease. */
#calc{perspective:2200px}
/* the fall: the window's content leaves upward, the next drops in */
#calc.fade{transition:opacity .22s ease,transform .26s ease;opacity:0;transform:translateY(-10px) scale(.99)}
#calc.fadein{transition:none;opacity:0;transform:translateY(-14px) scale(.985)}
#calc{transition:opacity .34s .04s ease,transform .5s cubic-bezier(.22,.7,.26,1)}
@media(prefers-reduced-motion:reduce){#calc{transition:none}}

/* ── My wallet ─────────────────────────────────────────────────────────────
   The reader's own screen, in the hub's language rather than the calculator's:
   GATA's cards (16px, an accent bloom in the corner, a hairline of light on the
   top edge), Inter at 600-800, solid gradient buttons, tinted tag pills, inset
   tracks. Every class here is prefixed wk- or scoped under #p-dele, so nothing
   the calculator names can reach in - and nothing here reaches out. */
#sv,.hdr-r,.brandbar,#p-dele,#txpop .txcard,#unpop .txcard,#clpop .txcard,#stpop .txcard,#atpop .txcard,#grpop .txcard{
  --wsolid:rgba(14,24,38,.97);
  
  --wblue:#3B9EFF;--wcyan:#62D9FF;--wgreen:#36D399;--wamber:#FFB155;--wburn:#FF7A45;--wgold:#F5C66B;
  --wsans:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --wmono:ui-monospace,"SF Mono","Roboto Mono",Menlo,Consolas,monospace;
  font-family:var(--wsans);color:var(--wt)}

#p-dele>.pw{gap:12px;width:100%;padding:0 0 16px}
#p-dele button{font-family:inherit}
#p-dele b{font-weight:700}
#p-dele #sd-mstrip .sd-well>b{font-weight:800}#p-dele #sd-mstrip .sd-well>b .sv-pho{font-weight:600}   /* the strip is the Easy view's, weight and all */
/* and its box and frame too: the Easy view's panel ground, border and top light */
#p-dele #sd-mstrip{background:linear-gradient(180deg,#131329,#0c0c1a);border-color:#34345c;box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
@media(min-width:901px){#p-dele #wbody{box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}}
/* Pro's three panels as Easy's: the same box (radius, border, ground, padding) and the same title - 15px,
   white, a short bar in the panel's colour before it - at the same place */
@media(min-width:901px){
  #p-dele #wbody .wk-pane{border-radius:12px;border-color:#34345c;background:linear-gradient(180deg,#131329,#0c0c1a);box-shadow:inset 0 1px 0 rgba(255,255,255,.03);padding:11px 14px}
  #p-dele #wbody .wk-pane>.wk-ph h3,#p-dele #wbody #wk-mine .wk-t1 h3{font-family:var(--wsans);font-size:15px;font-weight:700;letter-spacing:-.01em;text-transform:none;color:var(--wt,#f0eef8)}
  #p-dele #wbody #wk-mine .wk-t1 h3::before{background:#ffb02e;box-shadow:0 0 10px -1px #ffb02e}
  #p-dele #wbody #wk-plan .wk-t2 h3::before{background:#2ee06a;box-shadow:0 0 10px -1px #2ee06a}
  #p-dele #wbody #wk-mv .wk-t3 h3::before{background:#b9b0ff;box-shadow:0 0 10px -1px #b9b0ff}
  #p-dele #wbody :is(#wk-mine .wk-t1,#wk-plan .wk-t2,#wk-mv .wk-t3) h3::before{width:3px;height:15px;opacity:1}
  /* every title on one 32px line, Easy's and Pro's alike, so the six stand at one height */
  #p-dele #wbody .wk-pane>.wk-ph h3,#p-dele #wbody #wk-mine .wk-t1 h3,:is(#sv-over,#sv-auto) .sd-col>.sv-ph h3,#sv-auto .sd-col>.sv-ph h3{line-height:32px}
  :is(#sv-over,#sv-auto) .sd-col>.sv-ph,#sv-auto .sd-col>.sv-ph{min-height:32px}
  /* Stake (Easy and Pro): every panel's title row a filled band across the panel's top - the wallet card's build
     (a light from the top left, rings from the right), each panel its own colour; the content keeps its line */
  :is(#sv-over,#sv-auto) .sd-col>.sv-ph{margin:-11px -14px 0!important;padding:5px 14px 6px!important;min-height:43px!important;height:auto!important;max-height:none!important;box-sizing:border-box;border-radius:11px 11px 0 0;border-bottom:1px solid rgba(255,255,255,.08)}
  :is(#sv-over,#sv-auto) .sd-col>.sv-ph h3{color:#fff!important}
  :is(#sv-over,#sv-auto) .sd-col>.sv-ph h3::before{background:rgba(255,255,255,.9)!important;box-shadow:0 0 10px -1px rgba(255,255,255,.7)!important}
  #sd-move .sd-mvh .sd-mvn{color:rgba(255,255,255,.72)}
  /* the content under every band starts on one line (8px under it) */
  #sv-over #sd-list .fp-bc{margin-top:0}
}
/* the rank axis stands above the bars, the barcode under it */
#sv-over #sd-list .fp-ax{margin:0 0 5px}
/* a band is one line: the tag never drops under the title */
:is(#sv-over,#sv-auto) .sd-col>.sv-ph{flex-wrap:nowrap}:is(#sv-over,#sv-auto) .sd-col>.sv-ph h3{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}:is(#sv-over,#sv-auto) .sd-col>.sv-ph .sv-tag{flex:0 0 auto}
:is(#sv-over,#sv-auto) .sd-col>.sv-ph{gap:8px}:is(#sv-over,#sv-auto) .sd-col>.sv-ph .sv-tag{padding:4px 7px;letter-spacing:.06em}
/* narrower windows: every panel title a step smaller, Easy, Pro and Autopilot alike, so a title and its tag share the band */
@media(min-width:901px) and (max-width:1599px){:is(:is(#sv-over,#sv-auto) .sd-col>.sv-ph,#sv-auto .sd-col>.sv-ph,#p-dele #wbody #wk-mine .wk-t1,#p-dele #wbody #wk-plan>.wk-ph,#p-dele #wbody #wk-mv>.wk-ph) h3{font-size:14px!important}}
@media(min-width:901px) and (max-width:1299px){:is(:is(#sv-over,#sv-auto) .sd-col>.sv-ph,#sv-auto .sd-col>.sv-ph,#p-dele #wbody #wk-mine .wk-t1,#p-dele #wbody #wk-plan>.wk-ph,#p-dele #wbody #wk-mv>.wk-ph) h3{font-size:13px!important}:is(#sv-over,#sv-auto) .sd-col>.sv-ph{gap:6px}:is(#sv-over,#sv-auto) .sd-col>.sv-ph .sv-tag{padding:4px 6px;letter-spacing:0}}
:is(#sv-over,#sv-auto) .sd-col>.sv-ph .sv-tag.q{color:#fff;border-color:rgba(255,255,255,.45);background:rgba(255,255,255,.14)}
/* What your stake earns: its figures and their bars in the band's amber; restake's own figures stay green */
#sv-over #sd-sky{--se-rs:var(--sv-green)}
#sv-over #sd-sky :is(.se-mid,.se-ex)>:is(.se-row,.se-hero){--sv-green:var(--sv-amber)}
#sv-over #sd-sky .se-rsm{color:var(--se-rs)}
#sv-over #sd-sky .se-hero>.se-card{background:linear-gradient(0deg,rgba(255,176,46,.09),rgba(255,255,255,.012) 70%)}
/* the day, week and month boxes a little taller (the one-line short tier keeps its size) */
#sv-over #sd-sky .se-row .sd-fig:not(#z){padding-top:20px;padding-bottom:21px}
@media(min-width:901px) and (max-height:1000px){#sv-over #sd-sky .se-row .sd-fig:not(#z){padding-top:21px;padding-bottom:22px}}
@media(min-width:901px) and (max-height:760px){#sv-over #sd-sky .se-row .sd-fig:not(#z){padding-top:11px;padding-bottom:12px}}
@media(min-width:901px) and (max-height:640px){#sv-over #sd-sky .se-row .sd-fig:not(#z){padding-top:3px;padding-bottom:3px}}
/* What your stake earns and Enable restake: each box's colour line lies along its foot, the glow rising from it */
#sv-over :is(#sd-sky,#sd-rs) :is(.se-row .sd-fig,.se-card)::before{left:14px;right:14px;top:auto;bottom:0;width:auto;height:2px;border-radius:2px 2px 0 0}
#sv-over #sd-sky .se-row .sd-fig{background:linear-gradient(0deg,color-mix(in srgb,var(--rc) 9%,transparent),rgba(255,255,255,.012) 70%)}
/* stake on inactive validators: a red tag in What your stake earns' title row */
:is(#sv-over,#sv-auto) .sd-col>.sv-ph .sv-tag.se-off{color:#ffd9cf;border-color:rgba(255,140,110,.65);background:rgba(255,77,31,.32);font-weight:600;white-space:nowrap}
/* each banded section is framed in its band's colour: a thin fill down both sides and along the foot, over the
   border, so nothing moves */
:is(#sv-over #sd-list,#sv-over #sd-sky,#sv-over #sd-move,#sv-auto #sd-ado,#sv-auto #sd-asky,#sv-auto #sd-alist,#sv-proplist,#sv-daop,#sv-govlist){position:relative}
:is(#sv-over #sd-list,#sv-over #sd-sky,#sv-over #sd-move,#sv-auto #sd-ado,#sv-auto #sd-asky,#sv-auto #sd-alist,#sv-proplist,#sv-daop,#sv-govlist)::after{content:"";display:block!important;position:absolute;inset:-1px;border-radius:12px;padding:0 3px 3px;background:linear-gradient(315deg,var(--bandf));pointer-events:none;z-index:2;
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
#sv-over #sd-list{--bandf:#0f6b67,#123a52 58%,#141633}
#sv-over #sd-sky{--bandf:#8a5a12,#4a2f12 58%,#1f1630}
#sv-over #sd-move{--bandf:#0a3a22,#072a19 58%,#05140d}
#sv-proplist{--bandf:#1d4f8f,#173257 58%,#141633}
#sv-daop{--bandf:#5f6216,#393b15 58%,#19191f}
#sv-govlist{--bandf:#7d2e6e,#461f45 58%,#1a1230}
/* the band tags, a size smaller: one height in all three panels, the moves count a tag like the rest */
:is(#sv-over,#sv-auto) .sd-col>.sv-ph .sv-tag{padding:2px 7px;font-size:10px;line-height:1.35;gap:4px}
:is(#sv-over,#sv-auto) .sd-col>.sv-ph .sv-tag.q{font-size:8px;letter-spacing:.06em}
#sv-over #sd-move .sd-mvh .sv-tag.sd-mvn{margin-left:auto;min-width:0;color:#fff;border-color:rgba(255,255,255,.45);background:rgba(255,255,255,.14);display:block;overflow:hidden;text-overflow:ellipsis}
/* tags on a fill: a dark recess and bright type, so they read clearly on any band */
:is(#sv-over,#sv-auto) .sd-col>.sv-ph .sv-tag{color:#fff;border-color:rgba(255,255,255,.42);background:rgba(8,6,20,.34)}
:is(#sv-over,#sv-auto) .sd-col>.sv-ph .sv-tag.g{color:#c9ffdb;border-color:rgba(143,240,176,.62);background:rgba(4,30,14,.42)}
:is(#sv-over,#sv-auto) .sd-col>.sv-ph .sv-tag.se-off{color:#ffe4dc;border-color:rgba(255,150,120,.7);background:rgba(110,18,0,.55)}
#sv-over #sd-move .sd-mvh .sv-tag.sd-mvn{color:#fff;border-color:rgba(255,255,255,.42);background:rgba(8,6,20,.34)}
/* Enable restake: its title a green band like the panels', the card joined under it */
/* the day, week, month and year sit centred between the panel's title and Enable restake */
/* the panel's inner gap under the title is wider than the block's gap above Enable restake: the difference goes
   under the block, so it sits at the true centre */
/* = the panel's gap under its title less the block's gap: 10-8 over 1000px tall, 10-6 to 821, 8-6 to 641, 8-4 below */
#sv-over #sd-list>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.16),transparent 60%),linear-gradient(315deg,#0f6b67,#123a52 58%,#141633)}
#sv-over #sd-sky>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.16),transparent 60%),linear-gradient(315deg,#8a5a12,#4a2f12 58%,#1f1630)}
#sv-over #sd-move>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.07),transparent 60%),linear-gradient(315deg,#0a3a22,#072a19 58%,#05140d)}
/* phones: the same bands across the panel's top (its padding is 14px and 16px there) */
@media(max-width:900px){:is(#sv-over,#sv-auto) .sd-col>.sv-ph{margin:-14px -16px 0;padding:5px 16px 6px;min-height:43px;box-sizing:border-box;border-radius:11px 11px 0 0;border-bottom:1px solid rgba(255,255,255,.08)}
  :is(#sv-over,#sv-auto) .sd-col>.sv-ph h3{color:#fff}:is(#sv-over,#sv-auto) .sd-col>.sv-ph h3::before{background:rgba(255,255,255,.9);box-shadow:none}}
@media(min-width:901px){
  /* the wider padding leaves the Delegations table 4px less: its figures keep their room, the name gives */
  #p-dele #wbody #dmy col:nth-child(2){width:30px!important}#p-dele #wbody #dmy col:nth-child(4){width:66px!important}
  #p-dele #wbody #dmy col:nth-child(5){width:48px!important}#p-dele #wbody #dmy col:nth-child(6){width:50px!important}
  /* and its doors a touch smaller beside the larger title */
  #p-dele #wbody #wk-mine .wk-t1 .wk-unb{padding:0 6px;font-size:10px}
}
@media(min-width:901px) and (max-width:1399px){
  #p-dele #wbody #wk-mine .wk-t1{column-gap:4px}
  #p-dele #wbody #wk-mine .wk-t1 .wk-unb{padding:0 4px;font-size:9.5px;letter-spacing:0}
  #p-dele #wbody #wk-mine .wk-t1 .wk-unb.wk-stb{margin-left:auto}
}
@media(min-width:901px) and (max-width:1399px){
  #p-dele #wbody #dmy col:nth-child(2){width:26px!important}#p-dele #wbody #dmy col:nth-child(4){width:58px!important}
  #p-dele #wbody #dmy col:nth-child(5){width:46px!important}#p-dele #wbody #dmy col:nth-child(6){width:38px!important}
  #p-dele #wbody #dmy td{font-size:11px}
}
@media(min-width:901px) and (max-width:1299px){
  #p-dele #wbody #wk-mine .wk-t1{flex-wrap:wrap;height:auto;max-height:none;row-gap:4px;padding-bottom:4px}
}

/* the head: who is connected, the two tabs, two icon buttons */

.wk-addr{display:inline-flex;align-items:center;gap:6px;font-family:var(--wmono);}
.wk-addr::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--wgreen);box-shadow:0 0 8px var(--wgreen)}

.wk-ib:focus-visible,.wk-btn:focus-visible{outline:2px solid var(--wcyan);outline-offset:2px}

.wk-ib{border:1px solid var(--wbd2);background:rgba(255,255,255,.03);
display:grid;place-items:center;cursor:pointer;padding:0;transition:color .16s,border-color .16s,box-shadow .16s,transform .16s,background .16s;
}
#p-dele .wk-ib svg,#txpop .wk-ib svg{width:17px;height:17px;margin:0;max-height:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.wk-ib:hover{color:var(--wcyan);border-color:var(--wcyan);box-shadow:0 0 14px -4px var(--wcyan),0 6px 16px -8px rgba(0,0,0,.9);transform:scale(1.06)}

.wk-ib.busy svg{animation:wkspin .8s linear infinite}
@keyframes wkspin{to{transform:rotate(360deg)}}

/* buttons: GATA's solid gradient on dark ink, or a ghost */
.wk-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--wbd2);
line-height:1;color:var(--wt);background:transparent;cursor:pointer;white-space:nowrap;
transition:filter .12s,transform .12s,box-shadow .2s,opacity .2s}
#p-dele .wk-btn svg,#txpop .wk-btn svg{width:16px;height:16px;margin:0;max-height:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.wk-btn:hover{filter:brightness(1.08)}
.wk-btn:active{transform:translateY(1px)}
.wk-btn:disabled{opacity:.4;cursor:default;filter:none;transform:none;box-shadow:none}

.wk-go{border:0;color:#03130C;background:linear-gradient(180deg,#36D399,#1FA877);box-shadow:0 8px 26px -10px rgba(54,211,153,.6),inset 0 1px 0 rgba(255,255,255,.25)}

/* disconnected: one button in the middle of the room, the chooser under it */

/* connected: the four figures, then the ledger beside the plan and the moves */

#wk-moves{min-height:0}

/* the chain's height, live: the plan is solved on this block */

/* the reader's four figures, in the head of the ledger they describe */

/* amount presets: plain small buttons, the chosen one lit */
.wk-pre{display:inline-flex;gap:5px}
/* "N selected" beside an amount: its slot is always there, empty or not, so nothing moves when it
   appears (Self's Redelegate row and the Stake card) */
.wk-seln{flex:0 0 auto;display:inline-flex;align-items:baseline;height:22px;line-height:22px;min-width:10.5em;font-family:var(--wmono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--wf);white-space:nowrap;font-variant-numeric:tabular-nums}
.wk-seln b{font-size:11px;font-weight:700;letter-spacing:0;color:var(--wgreen);margin-right:5px}
.wk-pre button{padding:0 9px;border:1px solid var(--wbd2);background:transparent;cursor:pointer;transition:color .14s,border-color .14s,background .14s}
.wk-pre button:hover{color:var(--wt);border-color:var(--ws)}

.wk-empty{font-size:12.5px;font-weight:600;color:var(--wf);padding:14px 4px}

/* tag pills: an accent, tinted */
.wk-pl{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;white-space:nowrap;
--a:var(--ws);color:var(--a);border:1px solid color-mix(in srgb,var(--a) 25%,transparent);
}
.wk-pl.ok{--a:var(--wgreen)}.wk-pl.warn{--a:var(--wamber)}.wk-pl.dim{--a:var(--wf);box-shadow:none}
/* bars: an inset track, a gradient fill */
.wk-hb{display:block;border-radius:99px;overflow:hidden;min-width:56px;width:100%}
.wk-hb i{display:block;height:100%;min-width:3px;border-radius:99px;}
.wk-hb.hld i{background:repeating-linear-gradient(135deg,#FFB155 0 3px,rgba(255,177,85,.35) 3px 6px)}

.wk-lg{display:inline-block;border-radius:50%;object-fit:cover;vertical-align:middle;background:var(--wi);flex:0 0 auto}
.wk-lgx{text-align:center;font-weight:800;color:#fff;font-family:var(--wsans)}

.wk-foot{display:flex;flex-wrap:wrap;gap:6px;padding:10px 0 0;flex:0 0 auto}
.wk-foot:empty{display:none}

/* the plan: the answer first, then the three choices under it */

/* the five, as a checklist: tick box, rank, mark, name and record, what it
   would get, the rate before and after */

/* the moves: one line per message, source → destination, the amount */
.wk-mv{border-bottom:1px solid var(--wbd)}
.wk-mv:last-child{border-bottom:0}
.wk-mv .wk-lg{margin:0;width:20px;height:20px;line-height:20px;font-size:9px}
.wk-mv .f{grid-area:f;display:flex;align-items:center;gap:7px;min-width:0}
.wk-mv .f b{font-size:13px;font-weight:700;color:var(--wt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wk-mv .f i{font-style:normal;color:var(--wf);font-size:12px;flex:0 0 auto}
.wk-mv.stay .f i{font-size:10.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wk-mv .a{grid-area:a;display:flex;flex-direction:column;align-items:flex-end;gap:3px;font-family:var(--wmono);font-variant-numeric:tabular-nums;white-space:nowrap}
.wk-mv .a .wk-hb{width:80px;min-width:0;height:5px}
.wk-mv .r{grid-area:r;text-align:right;font-family:var(--wmono);white-space:nowrap;font-variant-numeric:tabular-nums}
.wk-mv .r s{color:var(--wf);margin-right:5px}
.wk-mv .r b{color:var(--wgreen);}

.wk-mv .g{grid-area:g;display:flex;flex-direction:column;align-items:flex-end;gap:1px;font-family:var(--wmono);color:var(--wgreen);font-variant-numeric:tabular-nums;white-space:nowrap}
.wk-mv .g.dim{color:var(--wf)}
.wk-mv .g em{font-style:normal;font-family:var(--wsans);text-transform:uppercase;color:var(--wf)}
/* the destination: who the reader is being sent to, in figures */
.wk-mv .f .from{display:inline-flex;align-items:center;gap:7px;min-width:0}
.wk-mv .f .from b{color:var(--ws);max-width:9ch}
.wk-mv .f .from .wk-lg{width:18px;height:18px;line-height:18px;opacity:.8}

.wk-mv .sub{display:flex;flex-wrap:nowrap;align-items:center;overflow:hidden;}
.wk-mv .st{display:inline-flex;flex-direction:column;gap:1px;flex:0 0 auto}
.wk-mv .st b{font-family:var(--wmono);font-variant-numeric:tabular-nums;white-space:nowrap}
.wk-mv .st i{font-style:normal;letter-spacing:.07em;text-transform:uppercase;color:var(--wf);white-space:nowrap}
.wk-mv .st.ok b{color:var(--wgreen)}.wk-mv .st.warn b{color:var(--wamber)}

/* governance, not built yet */

/* the signing card, in the same language */
.pop .card.txcard{background:var(--wc);border:1px solid var(--wbd2);}
.wk-txh{display:flex;align-items:center;gap:11px;padding:18px 22px 14px;border-bottom:1px solid var(--wbd)}

.wk-txh b{display:block;letter-spacing:-.01em;color:var(--wt)}
.wk-txh span{display:block;font-weight:600;color:var(--wf);margin-top:1px}
/* one grid for every row, so the arrows line up whatever the amounts are */
.txlist{padding:14px 22px 0;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto;align-items:center;gap:7px 8px;font-size:13px;font-weight:600;color:var(--wt)}
.txrow{display:contents}
.txrow span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.txrow i{font-style:normal;color:var(--wf)}
.txrow b{font-family:var(--wmono);font-size:12px;white-space:nowrap}
.txfee{padding:12px 22px 0;font-size:11.5px;font-weight:600;color:var(--wf)}
.txstep{padding:8px 22px 0;font-size:12.5px;font-weight:600;color:var(--ws);min-height:16px}
.txstep.ok{color:var(--wgreen)}.txstep.err{color:var(--wburn);white-space:pre-wrap;word-break:break-word}
.txstep b{color:var(--wt)}
.txbtns{display:flex;justify-content:flex-end;gap:8px;padding:16px 22px 18px}

/* the view row on a phone: the buttons keep the calculator's new scale on a
   wide screen; at 390px the row must still hold seven of them */

@media(max-width:700px){

/* on a phone the column is a document: blocks in order, nothing scrolls inside
     anything (a nested flex chain with min-height:0 collapsed the ledger to 0px) */

/* columns: rank, validator, bar, ATONE, share, APR, a year, status - the phone keeps rank, name, ATONE, APR, status */

.wk-foot .wk-pl{font-size:9.5px}

html[data-tab=dele] .calclab,html[data-tab=empty] .calclab,html[data-tab=connect] .calclab{display:none}
  
  .wk-mv .a{align-items:flex-start}
  .wk-mv .sub{padding-left:0;overflow-x:auto;scrollbar-width:none}
  
}
/* ── the descent's content language, everywhere (version 1, chosen 2026-09-20) ──
   One palette (the calculator's), mono caps for every label, figure cards for
   the numbers that matter, labelled stages for everything else, bordered rows
   for lists, one big number where one figure is the point. These rules sit
   last on purpose: the calculator's own chrome (prisms, tinted cards, pill
   rows) stays as the base and is quieted here rather than rewritten. */
:root{--void:#06060c;--edge:#232342;--edge2:#34345c;--ink:#e6e4f0;--ink2:#a5a3c4;--ink3:#6f6d94;--faint:#3a3a54;
--hot:#ffb02e;--burn:#ff4d1f;--cold:#6f66c8;--lit:#fff8dc;--card:#0b0b16;--card2:#111124;--inset:#0a0a14;
--blue:#6f66c8;--cyan:#2bc8bd;--green:#2ee06a;--amber:#ffb02e}
#sv,.hdr-r,.brandbar,#p-dele,#p-intro,#txpop .txcard,#unpop .txcard,#clpop .txcard,#stpop .txcard,#atpop .txcard,#grpop .txcard{--wc:#09090f;--wh:#0f0f1c;--wbd:#232342;--wbd2:#34345c;--wi:#0a0a14;--wchip:#0b0b16;--wsolid:rgba(11,11,22,.97);
--wt:#e6e4f0;--ws:#a5a3c4;--wf:#6f6d94;--wblue:#6f66c8;--wcyan:#2bc8bd;--wgreen:#2ee06a;--wamber:#ffb02e;--wburn:#ff4d1f;--wgold:#ffb02e;
--wsans:"Helvetica Neue",Helvetica,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;--wmono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace}
body{background:var(--void);background-image:radial-gradient(130% 62% at 50% 0%,#16162e 0%,#0a0a16 42%,var(--void) 74%)}
/* the bar: words in caps, the chip in caps */
.folder{background:linear-gradient(180deg,#0f0f20,rgba(6,6,12,0));border-bottom-color:var(--edge)}
/* the calculator: title, tabs, the view row, the stages, flat tiles */
.bt{font-size:clamp(16px,1.7vw,20px);font-weight:600;letter-spacing:-.015em}

.sec,.sec.tight,.duo .sec,.duo .sec:nth-child(n){border-radius:8px;background:#09090f;border-color:var(--edge);box-shadow:none}
.modes{border-radius:5px;padding:2px;background:var(--inset);border-color:var(--edge);box-shadow:none}
.mbtn{border-radius:3px;font-size:8px;letter-spacing:.16em;padding:4px 9px}
.mbtn[aria-pressed=true]{background:var(--hot);box-shadow:none}
.rval{font-weight:400}
/* home: the hero in the same tokens, the doors as outlined caps */
/* the wallet: a lip, a figure strip, stages, rows */

.wk-addr{font-size:10px;letter-spacing:.06em;text-transform:none;color:var(--wf);font-weight:400}
.wk-addr::before{display:none}

.wk-ib{border-radius:6px;background:var(--wchip);border-color:var(--wbd2);color:var(--ws);box-shadow:none;width:30px;height:30px}

.wk-lg{box-shadow:0 0 0 1px #ffffff18;margin-right:8px}

.wk-hb{height:4px;border:0;background:#16162c}
.wk-hb i{background:linear-gradient(90deg,#6f66c8,#b9b0ff)}.wk-hb.mv i{background:linear-gradient(90deg,#2ee06a,#8ef0c8)}

.wk-pl{font-family:var(--wmono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;font-weight:400;border-radius:3px;box-shadow:none;background:transparent}

.wk-pre button{border-radius:4px;font-family:var(--wmono);letter-spacing:.12em;font-weight:400;border-color:var(--wbd);color:var(--wf)}
.wk-pre button[aria-pressed=true]{color:#1b1440;background:#b9b0ff;border-color:#b9b0ff;box-shadow:none}

.wk-mv{border:1px solid var(--wbd);border-radius:6px;margin-bottom:5px;}

.wk-mv .f .from b{font-size:11px;font-weight:400}
.wk-mv .a{font-size:11.5px;font-weight:400;color:#fff8dc}
.wk-mv .r{font-size:11px;font-weight:400}.wk-mv .r b{font-weight:400}
.wk-mv .g{font-size:12px;font-weight:400}
.wk-mv .g em{font-size:7.5px;letter-spacing:.12em;font-weight:400}
.wk-mv .st b{font-weight:400;color:var(--ws)}
.wk-mv .st i{font-weight:400}
.wk-btn{font-family:var(--wmono);letter-spacing:.16em;text-transform:uppercase;font-weight:400;border-radius:6px;padding:0 16px}
.wk-btn.wk-go{border:1px solid rgba(46,224,106,.27);}

.wk-txh b{font-size:14px;font-weight:400}.wk-txh span{font-family:var(--wmono);font-size:8px;letter-spacing:.12em;text-transform:uppercase}
.txrow{font-weight:400;font-size:12px}.txrow b{font-weight:400;color:var(--wcyan)}
.txfee,.txstep{font-family:var(--wmono);font-size:9px;letter-spacing:.06em;font-weight:400}
.pop .card.txcard{border-radius:8px;box-shadow:none}

/* ── the η, C and S cards in the same language: a stage for a card, figure
   cards for the numbers, a stage inside for the two-figure bands, caps for
   every label, notes for the prose. Markup untouched; the stack is untouched. */
#qpop .card,#cpop .card,#spop .card{border-radius:8px;border:1px solid var(--edge2);background:#09090f;box-shadow:0 30px 80px -30px #000}
#qpop .vhead,#cpop .vhead,#spop .vhead{background:transparent;border-bottom:1px solid var(--edge);padding:16px 18px 14px;gap:12px;justify-content:flex-start}
#cpop .vhid.cmid,#spop .vhid{display:flex;align-items:center;gap:10px;flex-direction:row-reverse;justify-content:flex-end;margin:0}
#qpop .ptag,#cpop .ptag,#spop .ptag{font-family:var(--mono);font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:400;
background:transparent;border:0;box-shadow:none;padding:0;color:var(--ink2)}
#cpop .ptag.tc{color:#ff9b7a}#spop .ptag.ts{color:#8fe8e0}
/* the three heads, one design: the small disc, then the word, left; the same
   size and place on every card (the η disc used to be centred and larger) */
#qpop .vhead{flex-direction:row;justify-content:flex-start;min-height:0}
#qpop .vhead .disc,#cpop .vhead .disc,#spop .vhead .disc{position:static;transform:none;width:16px;height:16px;font-size:9px;margin:0;flex:0 0 auto}
#qpop .vhead .disc .kg,#cpop .vhead .disc .kg,#spop .vhead .disc .kg{width:72%;height:72%}
#qpop .vhead::after{content:"bonus share";font-family:var(--mono);font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--hot)}
#qpop .vgrid,#cpop .vgrid,#spop .vgrid,#qpop .vgrid.gbelow{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:transparent;border:0;margin:0;padding:12px 18px 0}
#qpop .vgrid.gbelow{padding-top:0;padding-bottom:0}
#qpop .vstat,#cpop .vstat,#spop .vstat{background:var(--inset);border:1px solid var(--edge);border-radius:7px;padding:8px 11px;gap:2px;align-items:flex-start}
#qpop .vstat:hover,#cpop .vstat:hover,#spop .vstat:hover{background:#0e0e1c}
#qpop .vk,#cpop .vk,#spop .vk{font-size:7.5px;letter-spacing:.16em;color:var(--ink3)}
#qpop .vv,#cpop .vv,#spop .vv{font-size:19px;letter-spacing:-.03em;color:var(--lit);line-height:1.2}
#qpop .vstat.hot .vv,#cpop .vstat.hot .vv,#spop .vstat.hot .vv{color:var(--hot)}
#qpop .vstat.proj .vv{color:var(--green)}
#qpop .pdate,#spop .pc,#spop .vsubn{font-family:var(--mono);font-size:8px;letter-spacing:.1em;color:var(--faint);text-transform:uppercase;margin-left:8px}
#spop .vsubn{display:block;margin:2px 0 0}
#qpop .vstat.sgo{cursor:pointer;border-color:var(--edge2)}
#qpop .vstat.sgo:hover{border-color:var(--hot)}
#qpop .vstat.sgo .sgoarr{color:var(--hot)}
#qpop .cgate{background:transparent;border:1px solid #ff6a3d4d;border-radius:8px;gap:6px;padding:6px}
#qpop .cgate .vstat{border-color:transparent}
#qpop .cgate .vstat.on{border-color:#ff6a3d66;background:#ff4d1f0d}
#qpop .cgate .vstat.on .vv{color:#ff9b7a}
#qpop .cgate::after{top:5px;right:8px}
#cpop .cband{padding:12px 18px 0;border:0}
#cpop .cbcap{font-family:var(--mono);font-size:7.5px;letter-spacing:.18em;color:var(--ink3);margin:0 0 6px;border:0;background:transparent;padding:0;box-shadow:none}
#cpop .cbrow{background:var(--inset);border:1px solid var(--edge);border-radius:7px;padding:10px 12px;margin:0}
#cpop .cbl{font-family:var(--mono);font-size:7.5px;letter-spacing:.16em}
#cpop .cbn{font-size:19px;letter-spacing:-.03em}
#cpop .cbs{font-family:var(--mono);font-size:8px;letter-spacing:.1em;color:var(--faint)}
#cpop .cbx{border-color:#ff6a3d4d;background:transparent}
#cpop .vstat.vfull.rdg{grid-column:1/-1;background:transparent;border:0;padding:0;align-items:stretch}
#cpop .rdgbox{max-width:none;background:var(--inset);border:1px solid var(--edge);border-radius:7px;padding:10px 12px;gap:8px;margin:0 0 14px}
#cpop .rdgc{font-family:var(--mono);font-size:7.5px;letter-spacing:.16em;color:var(--ink3)}
#cpop .rdgv{font-size:19px}
#qpop .bul{border-top:1px solid var(--edge);margin:12px 0 0;padding:12px 18px 14px;font-size:11px;color:var(--ink3)}
#qpop .bul.bul2{border-top:0;padding-top:0}
#qpop .bul li::before{background:var(--hot)}
#qpop .bul b{color:var(--ink2);font-weight:400}
#qpop .haltn,#cpop .haltn{font-family:var(--mono);border-radius:3px}
#spop .vgrid{padding-bottom:14px}
#qpop .card,#cpop .card,#spop .card{scrollbar-color:var(--edge2) #09090f}
/* the mode: the same cards, black */

/* ── Picks: three stages, five rows each, one figure that matters per row ── */
.duotab{gap:12px;align-items:start}
.duotab>div{background:#09090f;border:1px solid var(--edge);border-radius:8px;padding:11px 13px 8px}
.tcap,.tcap.hot,.tcap.earn,.tcap.cool{font-family:var(--mono);font-size:7.5px;letter-spacing:.18em;color:var(--ink3);margin:0 0 6px;padding:0}
.tcap.hot{color:var(--hot)}.tcap.earn{color:#b9b0ff}.tcap.cool{color:#8fe8e0}
.tcap i{font-size:7.5px;letter-spacing:.12em}
.ptw,.duotab .ptw{border:0;border-radius:0;margin:0;overflow:visible;background:transparent}
.ptab{border-collapse:collapse;border-spacing:0}
.ptab th,.ptab thead th{position:static;background:transparent;border:0;border-bottom:1px solid var(--edge);padding:0 9px 6px;font-family:var(--mono);font-size:7.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);font-weight:400}
.ptab td,.ptab td:first-child,.ptab td:last-child,.ptab td:nth-child(2){border:0;border-bottom:1px solid var(--edge);border-radius:0;background:transparent;padding:9px 9px;font-family:var(--mono);font-size:10.5px;color:var(--ink2);font-variant-numeric:tabular-nums}
.ptab tbody tr:last-child td{border-bottom:0}
.ptab tr.vrow:hover td{background:#0e0e1c}
.ptab .rkc{font-size:9px;color:var(--faint)}
/* the name cell stays a table cell: a flex td draws its border on its own baseline */
.ptab td.nm,.ptab td:nth-child(2).nm{display:table-cell;font-family:var(--sans);font-size:12px;color:var(--lit);max-width:none;white-space:nowrap;vertical-align:middle}
.ptab td.nm .tlg,.ptab td.nm span{display:inline-block;vertical-align:middle}
.ptab td.nm .tlg{margin-right:7px}
.ptab .tlg{width:15px;height:15px;box-shadow:0 0 0 1px #ffffff18}
.ptab td:nth-child(3){font-size:14px;letter-spacing:-.02em;color:var(--lit)}
.ptab td.up,.ptab td.dn{color:var(--lit)}
.ptab .ok{color:var(--green)}.ptab td:nth-child(3).ok{color:var(--green)}
.ptab .warn{color:var(--burn)}
.pane .note{font-family:var(--mono);font-size:9px;letter-spacing:.04em;line-height:1.6;color:var(--ink3);max-width:none;margin-top:12px}
/* ── the wallet, at a readable scale; a move as a comparison ── */

/* the soon tag on the wallet's tab: the bar's small superscript, not a pill */

#p-dele .wk-ib svg{width:14px;height:14px}

.wk-lg{width:20px;height:20px}
.wk-lgx{line-height:20px;font-size:9px}

.wk-pre button{height:34px;font-size:10px}

.wk-btn{font-size:10.5px;height:38px}

/* a move: one side, the amount and the difference, the other side; the
   destination's record under it */
.wk-mv{display:grid;grid-template-columns:minmax(0,1fr) 128px minmax(0,1fr);grid-template-areas:"l m r" "s s s";align-items:center;gap:4px 12px;padding:9px 11px}
.wk-mv .side{display:flex;align-items:center;gap:9px;min-width:0}
.wk-mv .side:last-of-type{flex-direction:row-reverse;text-align:right}
.wk-mv .side .who{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}
.wk-mv .side .who b{font-size:13.5px;font-weight:400;color:#fff8dc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wk-mv .side .who small{font-family:var(--wmono);font-size:8.5px;letter-spacing:.02em;color:var(--wf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wk-mv .side .rate{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:0 0 auto}
.wk-mv .side:last-of-type .rate{align-items:flex-start}
.wk-mv .side .rate i{font-style:normal;font-family:var(--wmono);font-size:7.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--wf)}
.wk-mv .side .rate b{font-family:var(--wmono);font-size:15px;font-weight:400;color:var(--ws);letter-spacing:-.02em}
.wk-mv .side:last-of-type .rate b{color:var(--wgreen)}
.wk-mv .side .wk-lg{margin:0}
.wk-mv .mid{grid-area:m;display:flex;flex-direction:column;align-items:center;gap:1px;text-align:center}
.wk-mv .mid b{font-family:var(--wmono);font-size:16px;font-weight:400;color:#fff8dc;letter-spacing:-.02em}
.wk-mv .mid i{font-style:normal;font-family:var(--wmono);font-size:7.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--wf)}
.wk-mv .mid em{font-style:normal;color:var(--wf);font-size:14px;line-height:1}
.wk-mv .mid u{text-decoration:none;font-family:var(--wmono);font-size:11px;color:var(--wgreen);white-space:nowrap}
.wk-mv .mid u.dim{color:var(--wf)}
.wk-mv .side:first-of-type{grid-area:l}.wk-mv .side:last-of-type{grid-area:r}
.wk-mv .sub{grid-area:s;padding:6px 0 0;border-top:1px dashed var(--wbd);margin-top:4px;gap:0 12px}
.wk-mv .st b{font-size:10.5px}.wk-mv .st i{font-size:7.5px}
.wk-mv.stay .side:last-of-type{visibility:hidden}
.wk-mv .sub:empty{display:none}
@media(max-width:700px){.wk-mv{grid-template-columns:minmax(0,1fr);grid-template-areas:"l" "m" "r" "s"}.wk-mv .side:last-of-type{flex-direction:row;text-align:left}.wk-mv .side:last-of-type .rate{align-items:flex-end}}
/* the wallet's tabs follow the name; the page tabs stay on the right of the
   title and wear their own shape - framed caps chips, the open one filled in
   its accent - so they never read as the bar's underlined words */

.brandbar .tabs{margin-left:auto;gap:6px;height:auto}

   /* the underline was the word-tab's; a chip has its fill */

/* three layers, told apart: the bar is the site; the section head is a band
   of its own (a framed strip with the title and its tabs); the content below
   is stages on the ground */
.w#calc>.brandbar{padding:0 16px 0 18px;height:50px;border:1px solid var(--edge);border-radius:8px;background:linear-gradient(180deg,#0e0e1e,#09090f);margin-bottom:12px;box-sizing:border-box}

@media(max-width:620px){.w#calc>.brandbar{height:auto;padding:8px 12px}}
/* ── My wallet, uplifted: three stages, each in its colour; short labels;
   the figures as coloured cards; one distribution bar; the answer where the
   choice is made; the gain where the signature is ── */

#wk-moves{--a:#2ee06a}

/* the distribution: one bar, a segment per validator, its share as its width */

/* the left column: My stake keeps its figures, its bar and three rows in view
   (the ledger scrolls for the rest); Strategy takes what is left and its list
   scrolls inside - the screen itself never does */

#wk-plan{flex:1 1 auto;}

/* strategy: the answer as the big figure between the amount and the list */

/* moves: the gain, big */

.wk-mv{background:radial-gradient(120% 120% at 100% 0%,rgba(46,224,106,.05),transparent 55%),var(--wchip)}
.wk-btn.wk-go{background:linear-gradient(180deg,rgba(46,224,106,.16),rgba(46,224,106,.06));border-color:rgba(46,224,106,.45);color:#8ef0c8;box-shadow:0 0 18px -8px rgba(46,224,106,.8)}
.wk-btn.wk-go:hover{filter:brightness(1.15)}
.wk-btn.wk-go:disabled{box-shadow:none}

/* ── one Strategy: the amount, the answer, every validator that would earn
   more than the stake earns now (the reader ticks; nothing is pre-ticked and
   nothing is called best), then what moves, then the signature ── */

#wk-mine{flex:1 1 auto;}

#wk-plan{min-height:0}

.wk-moves{flex:0 0 auto;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
.wk-moves:empty{display:none}
/* a move, in one line: from → to, the amount, the difference a year */

#wk-moves{display:none}

/* the identity in the card's head, small; the gate keeps the room */
#p-dele>.pw{padding-top:0}

#wk-mine .wk-addr{font-size:8.5px;white-space:nowrap}

#wk-mine .wk-ib{width:26px;height:26px}#wk-mine .wk-ib svg{width:12px;height:12px}

/* the bar's wallet button: a lit chip, and the account's name once connected */

/* the list's record as columns in colour: fee, 90-day uptime, jailed */

/* ── one section, one column, the pane scrolls as a document: the wallet,
   the delegations, then the redelegation list under its announcement ── */
#p-dele{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--edge2) transparent}

#wk-mine{min-height:0;overflow:visible}
#wk-mine .wk-foot{padding:8px 0 0}

.wk-moves{max-height:none;overflow:visible}

/* ── the gate: the wallet choice is the screen. A framed card on a lit ground,
   the two wallets as tiles, the chain and its live dot, one line of what is
   read. No popup, no lone button. ── */

/* the section words sit in the middle of the bar, between the mark and the wallet */

/* the soon tag: a small badge after the word, on its line */

/* home: the muscle, then the name */
.introby{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:inline-flex;align-items:center;gap:8px;margin:0;text-decoration:none;color:var(--ink3);transition:color .2s}
#p-intro .introby img{width:18px;height:18px;border-radius:5px;display:block;opacity:.85;transform:translateY(-1px);margin-left:-2px}
.introby span{font-family:var(--mono);font-size:8.5px;letter-spacing:.24em;text-transform:uppercase;white-space:nowrap}
.introby:hover{color:var(--ink)}
/* home's one door: plain words and an arrow under the headline, into the first tab */
.introgo{position:relative;display:inline-flex;align-items:center;gap:10px;margin-top:30px;color:var(--ink2);text-decoration:none;
font-size:clamp(15px,1.4vw,18px);font-weight:600;letter-spacing:.01em;line-height:1}
/* the word's box keeps room for descenders, so centring on the box sets the arrow low: it is lifted
   onto the middle of the capitals (measured on the pixels: 0.3em) */
.intro .introgo svg{position:static;inset:auto;display:block;flex:0 0 20px;width:20px;height:20px;max-width:none;transform:translateY(-.3em);fill:none;stroke:#2bc8bd;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.introgo:hover{color:var(--ink)}.intro .introgo:hover svg{transform:translate(4px,-.3em)}
.introgo:focus-visible{outline:2px solid #2bc8bd;outline-offset:6px;border-radius:4px}
@media(prefers-reduced-motion:no-preference){.intro .introgo svg{transition:transform .18s}}
/* ── the connect section: the whole section is the screen. No card inside a
   frame - the ground is the section, the words and the two wallets sit on it ── */

/* the bar's wallet door is constant; the disconnect is the GATA app's: a ghost
   button, the wallet's mark at its left, the provider small over the word */

/* ── My wallet, dense. One strip for the wallet; two fixed panes side by
   side, both paged, rows of 30px, figures inline; nothing scrolls the page ── */
#p-dele{overflow:hidden}
#p-dele>.pw{height:100%;min-height:0;display:flex;flex-direction:column}
.wk-body{display:flex;flex-direction:column;gap:10px;flex:1 1 auto;min-height:0}

.wk-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:10px;flex:1 1 auto;min-height:0}
.wk-pane{display:flex;flex-direction:column;border:1px solid var(--wbd);border-radius:8px;padding:8px 12px 8px;position:relative;overflow:hidden}
.wk-pane::before{content:"";position:absolute;left:14px;right:14px;top:0;height:1px;background:linear-gradient(90deg,transparent,var(--a),transparent);opacity:.9}
#wk-mine{--a:#6f66c8}#wk-plan{--a:#2ee06a}
.wk-ph{display:flex;align-items:center;gap:10px;height:30px;flex:0 0 auto}
.wk-ph h3{margin:0;font-family:var(--wmono);font-size:9px;letter-spacing:.22em;text-transform:uppercase;font-weight:400;}
.wk-pn{font-family:var(--wmono);font-size:9px;letter-spacing:.1em;color:var(--wf)}
.wk-pg{margin-left:auto;display:inline-flex;align-items:center;gap:2px;font-family:var(--wmono);font-size:9px;letter-spacing:.08em;color:var(--wf)}
.wk-pg button{width:22px;height:22px;border-radius:4px;border:1px solid var(--wbd);background:transparent;color:var(--ws);cursor:pointer;font:inherit;font-size:11px;line-height:1;padding:0}
.wk-pg button:hover{border-color:var(--ws);color:var(--wt)}
.wk-pg button:disabled{opacity:.3;cursor:default}
.wk-pg span{padding:0 6px;white-space:nowrap}
/* the tables: fixed rows, a page at a time */
.wk-tbl2{flex:0 0 auto}
.wk-tbl2 table{width:100%;border-collapse:collapse;table-layout:fixed}
.wk-tbl2 th{font-family:var(--wmono);font-size:7.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:400;text-align:right;padding:0 6px 4px;border-bottom:1px solid var(--wbd);white-space:nowrap}
.wk-tbl2 td{height:30px;padding:0 6px;text-align:right;border-bottom:1px solid #16162a;font-family:var(--wmono);font-size:11px;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}

.wk-tbl2 th.l,.wk-tbl2 td.l{text-align:left}
.wk-tbl2 th.c,.wk-tbl2 td.c{text-align:center}
.wk-tbl2 td.nm{font-family:var(--wsans);font-size:12px;color:#fff8dc}
.wk-tbl2 td.nm .wk-lg{width:16px;height:16px;margin-right:7px;vertical-align:middle}
.wk-tbl2 td.nm .wk-lgx{line-height:16px;font-size:7px}
.wk-tbl2 td.nm span{vertical-align:middle}
.wk-tbl2 td.amt{color:#fff8dc}
.wk-tbl2 td.amt .lk{margin-left:5px;color:var(--wamber)}
.wk-tbl2 td.amt .lk svg{width:9px;height:9px;fill:none;stroke:currentColor;stroke-width:2.2;margin:0;display:inline;vertical-align:-1px}
.wk-tbl2 td .sb{width:38px;height:4px;border-radius:2px;background:#16162c;vertical-align:middle;margin-left:6px;overflow:hidden}
.wk-tbl2 td .sb i{display:block;height:100%;background:#b9b0ff}
.wk-tbl2 td .sb.hld i{background:var(--wamber)}
.wk-tbl2 td.rk{color:var(--wf);font-size:10px}
.wk-tbl2 td.rw{color:var(--wgreen)}
.wk-tbl2 .ok{color:var(--wgreen)}.wk-tbl2 .warn{color:var(--wamber)}.wk-tbl2 .bad{color:var(--wburn)}.wk-tbl2 .dim{color:var(--wf)}
/* the closing "Inactive and jailed validators" row of the stake and redelegate lists: a clear band
   across the table that folds open into rows - an inactive validator can be ticked, a jailed one
   cannot (ij-) */
.wk-tbl2 tr.ij-t td{height:auto;padding:10px 0 6px;border-bottom:0;text-align:left;overflow:visible}
.ij-b{width:100%;display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;cursor:pointer;
border:1px solid var(--wbd2);background:linear-gradient(90deg,rgba(255,255,255,.055),rgba(255,255,255,.02));
font-family:var(--wsans);font-size:13px;color:var(--ws);text-align:left}
.ij-b span{color:var(--wt);font-weight:700}
.ij-b i{font-style:normal;font-family:var(--wmono);font-size:10.5px;font-weight:600;padding:1px 8px;border:1px solid var(--wbd2);border-radius:999px;color:var(--wt)}
.ij-b em{font-style:normal;font-size:11.5px;color:var(--ws);margin-left:auto}.ij-b em b{color:#2ee06a;font-weight:600}
.ij-b u{width:8px;height:8px;border-right:2px solid var(--ws);border-bottom:2px solid var(--ws);transform:rotate(45deg);margin:-4px 4px 0 6px}
.ij-t.open .ij-b u{transform:rotate(-135deg);margin-top:3px}
.ij-b:hover{border-color:var(--ws);background:linear-gradient(90deg,rgba(255,255,255,.08),rgba(255,255,255,.03))}.ij-b:hover u{border-color:var(--wt)}
.ij-b:focus-visible{outline:2px solid var(--av);outline-offset:2px}
.wk-tbl2 tr.ij-r td{text-align:left;padding:0 8px}
.wk-tbl2 tr.ij-r.on td{background:rgba(46,224,106,.06)}
.ij-w{display:flex;align-items:center;gap:8px;min-width:0}
.ij-w input{appearance:none;-webkit-appearance:none;flex:0 0 15px;width:15px;height:15px;margin:0;border-radius:4px;border:1px solid #5a5a88;
background:linear-gradient(180deg,#17172f,#0e0e1d);cursor:pointer;position:relative}
.ij-w input:hover{border-color:var(--ws)}
.ij-w input:checked{background:linear-gradient(180deg,#3cf07a,#22c65c);border-color:#2ee06a}
.ij-w input:checked::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;border:solid #062012;border-width:0 2px 2px 0;transform:rotate(45deg)}
.ij-w input:focus-visible{outline:2px solid #2ee06a;outline-offset:2px}
.ij-x{flex:0 0 15px;width:15px}
.ij-w .wk-lg{width:16px;height:16px;margin:0}.ij-w .wk-lgx{line-height:16px;font-size:7px}
.ij-r.no .ij-w .wk-lg,.ij-r.no .ij-n{opacity:.55}
.ij-n{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;font-family:var(--wsans);font-size:12px;color:var(--wt)}
.ij-tag{flex:0 0 auto;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;padding:1px 6px;border-radius:4px;border:1px solid currentColor}
.ij-tag.j{color:var(--wburn)}.ij-tag.i{color:var(--ws)}
.ij-s{flex:0 0 auto;color:var(--ws)}
.ij-e{flex:0 0 auto;color:var(--wf);font-size:10px}

.wk-tbl2 td.ck{width:22px;padding:0 0 0 4px}
.wk-tbl2 td.ck input{appearance:none;-webkit-appearance:none;margin:0;border:1px solid var(--wbd2);cursor:pointer;position:relative;vertical-align:middle}

.wk-tbl2 td.ck input:checked::after{content:"";position:absolute;border:solid #062012;border-width:0 2px 2px 0;transform:rotate(45deg)}

.wk-tbl2 td.r2 s{text-decoration:none;color:var(--wf)}.wk-tbl2 td.r2 b{font-weight:400;color:var(--wgreen)}.wk-tbl2 td.r2 em{font-style:normal;color:var(--wf);margin:0 4px}
.wk-pf{margin-top:auto;padding-top:8px;display:flex;align-items:center;gap:12px;flex:0 0 auto}

.wk-pf .wk-foot{padding:0;flex:0 0 auto}
/* redelegation: the announcement inline, the controls in one row, the answer as a strip with the button */

.wk-ph .wk-ib{width:26px;height:26px;margin-left:6px}

@media(max-width:900px){.wk-two{grid-template-columns:1fr}#p-dele{overflow-y:auto}#p-dele>.pw{height:auto;min-height:100%}.wk-pane{overflow:visible}}
/* the strip's pairs: label, value, unit on one centre line, in their colours */

.wk-pf{justify-content:flex-end}

/* the announcement, two lines: the count with its noun, then the news */

/* the message under the title: the count with its noun, then the news, as a
   quiet green line across the pane */

/* a note on the map: every tile opens its validator */
.tapnote{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:7.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink3);margin-right:auto;white-space:nowrap}
#p-home .tapnote svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;margin:0;max-height:none;color:var(--hot);opacity:.85}
.frow{justify-content:space-between}
/* the refresh: small, symmetric, turns green and a quarter turn on hover, spins while reading */
.wk-ph .wk-ib,#wk-plan .wk-ph .wk-ib{width:22px;height:22px;border-radius:5px;border-color:var(--wbd2);background:var(--wi);color:var(--ws);box-shadow:none;transform:none;transition:color .16s,border-color .16s,background .16s}
#p-dele .wk-ph .wk-ib svg{width:12px;height:12px;stroke-width:2.2;transition:transform .3s cubic-bezier(.2,.7,.25,1)}
.wk-ph .wk-ib:hover{color:var(--wgreen);border-color:rgba(46,224,106,.45);background:rgba(46,224,106,.06);transform:none;box-shadow:none}
.wk-ph .wk-ib:hover svg{transform:rotate(90deg)}
.wk-ph .wk-ib.busy{color:var(--wgreen);border-color:rgba(46,224,106,.45)}
.wk-ph .wk-ib.busy svg{animation:wkspin .8s linear infinite}
/* ── the signing card: what moves where, with the marks; what it does to the
   rate; the 21-day lock, plainly; the fee; one button that says what it does ── */
.pop .card.txcard{max-width:520px}
.txcard .wk-txh{padding:16px 20px 12px;align-items:center}
.txcard .wk-txh b{font-size:15px}
.txcard .wk-txh span{text-transform:none;letter-spacing:.04em;font-size:9px}
.txsum{margin-left:auto;font-family:var(--wmono);font-size:9px;letter-spacing:.08em;color:var(--ws);text-align:right;line-height:1.5}
.txans{display:flex;align-items:center;gap:18px;padding:12px 20px 0}
.txans .p{display:flex;flex-direction:column;gap:1px}
.txans .p i{font-style:normal;font-family:var(--wmono);font-size:7.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--wf)}
.txans .p b{font-family:var(--wmono);font-size:20px;font-weight:400;letter-spacing:-.03em;color:#fff8dc;line-height:1.1}
.txans .p.aft b,.txans .p.gain b{color:var(--wgreen)}
.txans .arr{color:var(--wf);font-size:16px}
.txcard .txlist{display:block;padding:12px 20px 0;max-height:220px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
.txcard .txrow{display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr) 92px;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #16162a;font-size:12px;font-weight:400}
.txcard .txrow:last-child{border-bottom:0}
.txcard .txrow .f{display:flex;align-items:center;gap:7px;min-width:0}
.txcard .txrow .f b{font-weight:400;color:var(--ws);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.txcard .txrow .f.to b{color:#fff8dc}
.txcard .txrow .f .wk-lg{width:16px;height:16px;margin:0}.txcard .txrow .f .wk-lgx{line-height:16px;font-size:7px}
.txcard .txrow i{font-style:normal;color:var(--wf);text-align:center}
.txcard .txrow .a{text-align:right;font-family:var(--wmono);font-size:11.5px;color:var(--wcyan);white-space:nowrap}
.txlock{margin:12px 20px 0;padding:8px 10px;border:1px solid rgba(255,176,46,.28);border-radius:5px;background:rgba(255,176,46,.05);
font-family:var(--wmono);font-size:9px;letter-spacing:.04em;line-height:1.6;color:var(--ws);display:flex;gap:9px;align-items:flex-start}
.txlock svg{width:12px;height:12px;flex:0 0 auto;fill:none;stroke:var(--wamber);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;margin:2px 0 0;max-height:none}
.txlock b{color:var(--wamber);font-weight:400}
.txcard .txfee{padding:10px 20px 0}
.txcard .txstep{padding:6px 20px 0}
.txcard .txbtns{padding:14px 20px 16px}
/* the chain's height under the name, ending where the name ends */
.bw{position:relative;display:flex;align-items:center}
.wordmark{padding-top:0}

@media(max-width:620px){.bw{display:none}}
/* how fresh: seconds since the last read, counting on its own */
.wk-ago{margin-left:auto;font-family:var(--wmono);font-size:8.5px;letter-spacing:.06em;text-transform:none;color:var(--wf);white-space:nowrap;font-variant-numeric:tabular-nums}
.wk-ago.fresh{color:var(--wgreen)}
.wk-ph .wk-ib,#wk-plan .wk-ph .wk-ib{margin-left:8px}
/* ── the phone, after everything above: no window frame, a view row that fits,
   the wallet as one column with the columns a phone can hold ── */
@media(max-width:700px){
  .w#calc,.panes>.w{border:0;background:transparent;box-shadow:none;padding:0;border-radius:0}
  .calclab{display:none}
  .panes{padding:12px 12px 0}
  .frow{flex-wrap:wrap;gap:6px}
  .tapnote{flex:1 1 100%;margin:0 0 2px}
  .modes{width:100%;justify-content:space-between;gap:1px;padding:2px}
  .mbtn{flex:1 1 0;padding:6px 0;font-size:7.5px;letter-spacing:.06em;text-align:center}
  .duotab{grid-template-columns:1fr}
  /* the wallet */

.wk-two{grid-template-columns:1fr;gap:10px}
  .wk-pane{overflow:hidden;padding:8px 10px}
  .wk-tbl2 table{table-layout:auto}
  .wk-tbl2 th,.wk-tbl2 td{padding:0 4px}
  .wk-tbl2 td.nm{max-width:0;width:40%}
  #dmy th:nth-child(6),#dmy td:nth-child(6){display:none}

.wk-pf{justify-content:flex-start}
  .txcard .txrow{grid-template-columns:minmax(0,1fr) 14px minmax(0,1fr);grid-template-areas:"f ar t" "a a a"}
  .txcard .txrow .f:first-child{grid-area:f}.txcard .txrow i{grid-area:ar}.txcard .txrow .f.to{grid-area:t}.txcard .txrow .a{grid-area:a;text-align:left}
  .txans{flex-wrap:wrap;gap:10px 14px}
}
/* the stake input on the right, one max beside it; the list scrolls inside */

.wk-max{height:28px;padding:0 9px;border-radius:4px;border:1px solid var(--wbd);background:transparent;color:var(--wf);font-family:var(--wmono);font-size:8px;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.wk-max b{font-weight:400;color:var(--ws);letter-spacing:.04em;font-size:9px}
.wk-max:hover{color:var(--wt);border-color:var(--ws)}
#wk-plan .wk-tbl2{min-height:120px;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
#wk-plan .wk-tbl2 thead th{position:sticky;top:0;background:var(--wc);z-index:1}

/* the wallet, lifted out of the dark: lighter grounds, brighter hairlines and
   type, so the figures read without leaning in */
#sv,.hdr-r,.brandbar,#p-dele,#txpop .txcard,#unpop .txcard,#clpop .txcard,#stpop .txcard,#atpop .txcard,#grpop .txcard{--wc:#0e0e1d;--wh:#16162a;--wbd:#2a2a4a;--wbd2:#3e3e66;--wi:#0b0b19;--wchip:#12122200;--wt:#f0eef8;--ws:#c1bfdc;--wf:#8f8db4}

.wk-pane{background:linear-gradient(180deg,#10101f,#0d0d1b)}
.wk-tbl2 td{border-bottom-color:#22223c}
.wk-tbl2 tr:hover td{background:#171730}
.wk-tbl2 tr.on td{background:rgba(46,224,106,.09)}
.wk-tbl2 th{color:#9d9bc2}

.wk-ph h3{color:var(--a)}

.wk-max{border-color:var(--wbd2)}
.wk-tbl2 td.ck input{border-color:#5a5a88;}
.wk-tbl2 td .sb{display:none}
/* the account is the disconnect: mark, name and address, the leave glyph */

/* no strip: the balances in the Delegations head, the account in the
   Redelegation head; both panes hug their tables like the Picks stages */
.wk-two{align-items:start}
.wk-pane{flex:0 0 auto;min-height:0}

#wk-plan .wk-ph{height:auto;min-height:38px;flex-wrap:nowrap}

#wk-plan .wk-tbl2{flex:0 0 auto;height:262px;overflow-y:auto}
#wk-mine .wk-ph{gap:8px}
#wk-mine .wk-ph .wk-pn{white-space:nowrap}

#wk-mine .wk-ph .wk-pg{flex:0 0 auto}
#wk-mine .wk-ph .wk-foot{margin-left:auto;display:flex;flex-wrap:nowrap;gap:6px;padding:0}
#wk-mine .wk-ph .wk-foot:empty{display:none}
#wk-mine .wk-ph .wk-foot .wk-pl{font-size:7.5px;padding:2px 7px}
#wk-mine .wk-pf{height:auto;padding:6px 0 0;justify-content:flex-end}
#wk-mine .wk-pf .wk-pg:empty{display:none}
/* the wallet's door: a word and an arrow, in the tab's own type; the arrow
   travels on hover, the word is lit and underlined while you are inside */

/* the delegations pane at the width of a Picks table; the rest is the redelegation */

/* the delegations head in two lines: title, count and the held tag; then the balances */
#wk-mine .wk-ph{flex-wrap:wrap;height:auto;min-height:30px;row-gap:2px;padding-bottom:4px}
#wk-mine .wk-ph .wk-foot{order:2}

/* the left column: a small Balance pane (with the account), then the delegations */

/* one pane, two headings: Balance (with the account) above a rule, then Delegations */

/* Balance: five equal boxes across the pane - ATONE, PHOTON, staked, rewards, APR */

#wk-mine .wk-b5{font-family:var(--wmono)}
#wk-mine .wk-b5 i{display:flex;align-items:center;font-style:normal;text-transform:uppercase;white-space:nowrap}
#wk-mine .wk-b5 i img{border-radius:50%;flex:0 0 auto;margin:0;max-height:none}
#wk-mine .wk-b5 b{font-weight:400;color:#fff8dc;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#wk-mine .wk-b5 b.pho{color:#2bc8bd;margin:0}
#wk-mine .wk-b5 b.warn{color:#ff4d1f}
#wk-mine .wk-b5 b.ok{color:#2ee06a}
#wk-mine .wk-b5 b#ds-rew{color:#2ee06a}

/* the stake row: one field under the title, max riding inside its right edge; the
   placeholder is set in the sans face and dimmed so it reads as a hint, not a value;
   the page's amber focus halo does not belong here */

#wk-plan .wk-field{display:inline-flex;align-items:center;height:28px;padding:0 4px 0 0;border-radius:6px;border:1px solid var(--wbd2);
background:linear-gradient(180deg,#0b0b18,#0e0e1d);box-shadow:inset 0 1px 0 #ffffff06;transition:border-color .15s,box-shadow .15s}
#wk-plan .wk-field:hover{border-color:var(--ws)}
#wk-plan .wk-field:focus-within{border-color:#b9b0ff;box-shadow:0 0 0 3px rgba(185,176,255,.13),inset 0 1px 0 #ffffff06}
#wk-plan input.wk-amt2{flex:1 1 auto;min-width:0;height:100%;width:auto;margin:0;border:0;border-radius:6px 0 0 6px;background:transparent;
font-family:var(--wmono);font-variant-numeric:tabular-nums;outline:none;box-shadow:none;-webkit-appearance:none;appearance:none}
#wk-plan input.wk-amt2:focus,#wk-plan input.wk-amt2:focus-visible{box-shadow:none;outline:none}
#wk-plan input.wk-amt2::placeholder{font-family:var(--wmono);text-transform:uppercase;font-style:normal}
#wk-plan .wk-field .wk-max{border:1px solid var(--wbd2);gap:5px;flex:0 0 auto}

#wk-plan .wk-field .wk-max:hover{color:var(--wt);}
#wk-plan .wk-field .wk-max:hover b{color:#fff8dc}
/* validators ticked but no stake yet: the field asks for it without a word */
#wk-plan .wk-field.need{animation:wkneed 1.5s ease-in-out infinite}
#wk-plan .wk-field.need input.wk-amt2::placeholder{color:#ffb02e;opacity:.9}
#wk-plan .wk-field.need:focus-within{animation:none}
@keyframes wkneed{0%,100%{box-shadow:0 0 0 3px rgba(255,176,46,.14),0 0 16px -4px rgba(255,176,46,.6),inset 0 1px 0 #ffffff06}50%{box-shadow:0 0 0 5px rgba(255,176,46,.05),0 0 22px -4px rgba(255,176,46,.35),inset 0 1px 0 #ffffff06}}
@media(prefers-reduced-motion:reduce){#wk-plan .wk-field.need{animation:none}}
/* the heading as one line of three: the name, the address as a lit chip (its prefix in
   the accent, the copy glyph behind a hairline), the wallet's button - all 22px, centred */

#wk-mine .wk-bh h3{padding-top:3px}
#wk-mine .wk-bh .wk-addrw{margin-top:1px}

@media(max-width:700px){#wk-mine .wk-bh .wk-addrw{flex:0 1 auto;}}
/* a delegation row opens its validator's card */
#dmy tbody tr[data-v]{cursor:pointer}
#dmy tbody tr[data-v]:focus-visible{outline:1px solid var(--wcyan);outline-offset:-1px}
/* disconnect: back at the right of the Redelegation header - the wallet's mark and the
   leave glyph in one small square-cornered button the size of refresh */

/* the pane titles at a readable size; the account name stands at the same scale */
#wk-mine .wk-ph h3,#wk-plan .wk-ph h3{font-size:10.5px;letter-spacing:.2em}
/* Redelegate stands at the end of the stake row, the field at its left */

/* the answer rides in the stake row as three boxes: now -> after, ATONE/year, moves;
   Redelegate is grey until it can be signed; on a phone the boxes take the next line */

#wk-mv .wk-ans{align-items:center;min-width:0}
#wk-mv .wk-ans .p{display:inline-flex;align-items:center;border-radius:5px;border:1px solid var(--wbd2);
background:linear-gradient(180deg,#12122a,#0b0b18);box-shadow:inset 0 1px 0 #ffffff08;white-space:nowrap;position:relative;overflow:hidden}
#wk-mv .wk-ans .p::before{content:"";position:absolute;left:8px;right:8px;top:0;height:1px;background:linear-gradient(90deg,transparent,var(--c,#6f66c8),transparent);opacity:.9}
#wk-mv .wk-ans .p i{font-style:normal;font-family:var(--wmono);text-transform:uppercase;color:var(--wf)}
#wk-mv .wk-ans .p b{font-family:var(--wmono);font-weight:400;color:#fff8dc;font-variant-numeric:tabular-nums}
#wk-mv .wk-ans .p b.dim{color:var(--wf)}
#wk-mv .wk-ans .p .arr{color:var(--wf);}
#wk-mv .wk-ans .p.rate{--c:#b9b0ff}#wk-mv .wk-ans .p.rate b.aft{color:var(--wgreen)}
#wk-mv .wk-ans .p.gain{--c:#2ee06a}#wk-mv .wk-ans .p.gain b{color:var(--wgreen)}
#wk-mv .wk-ans .p.mv{--c:#2bc8bd}

/* the move as a live comparison: each side carries its figures, the better of each pair lit */

/* ── the gate lives in the left pane: one Connect button in the centre, the two tiles
   in its place once tapped; the right pane shows the chain's numbers meanwhile ── */

html:not([data-wallet]) #wk-mine{display:flex;flex-direction:column;}

/* nothing to refresh and no clock without a wallet; the chain's list may run long */
html:not([data-wallet]) #wrefresh,html:not([data-wallet]) #dago{display:none}
html:not([data-wallet]) #wk-plan .wk-tbl2{height:calc(16px + 14 * 30px)}
/* ── the plan pane narrower, the pair centred; the moves as their own stage under a rule ── */

#wk-plan .wk-mvh{margin-top:12px;padding-top:10px;border-top:1px solid var(--wbd2);position:relative}
#wk-plan .wk-mvh::before{content:"";position:absolute;left:0;right:0;top:-1px;height:1px;opacity:.6}
#wk-plan .wk-mvh h3{color:var(--wgreen)}
#wk-plan .wk-moves{margin-top:2px;overflow:visible}
#wk-plan .wk-moves table{width:100%;border-collapse:collapse;table-layout:fixed;font-family:var(--wmono);font-size:10.5px;font-variant-numeric:tabular-nums}
#wk-plan .wk-moves th{font-size:7px;letter-spacing:.16em;text-transform:uppercase;font-weight:400;color:var(--wf);text-align:right;padding:4px 6px 5px;border-bottom:1px solid var(--wbd);white-space:nowrap}
#wk-plan .wk-moves th.l{text-align:left}
#wk-plan .wk-moves td{padding:6px 6px;border-bottom:1px solid #16162a;text-align:right;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#wk-plan .wk-moves td.l{text-align:left}
#wk-plan .wk-moves td.nm{font-family:var(--wsans);font-size:11.5px;color:#fff8dc}
#wk-plan .wk-moves td.nm span{vertical-align:middle}
#wk-plan .wk-moves td.nm .wk-lg,#wk-plan .wk-moves td.nm .wk-lgx{width:15px;height:15px;line-height:15px;font-size:7px;margin-right:6px;vertical-align:middle}
#wk-plan .wk-moves td.up{color:var(--wgreen)}
#wk-plan .wk-moves td.dn,#wk-plan .wk-moves td.dim{color:var(--wf)}
#wk-plan .wk-moves td.ar{text-align:center;color:var(--wgreen);font-size:13px;padding:0}
#wk-plan .wk-moves td.amt{color:#fff8dc}
#wk-plan .wk-moves td.gn{color:var(--wgreen)}
#wk-plan .wk-moves td.gn i{display:block;font-style:normal;font-size:7px;letter-spacing:.1em;color:var(--wamber)}
#wk-plan .wk-moves tr.stay td{color:var(--wf)}
/* the gain rides beside a ticked validator's name */
#dpicks td.nm .gtag{font-style:normal;font-family:var(--wmono);letter-spacing:.02em;color:var(--wgreen);border:1px solid rgba(46,224,106,.3);border-radius:3px;background:rgba(46,224,106,.06);vertical-align:middle;}
#prolist .wk-tbl2 td.nm .gtag{font-style:normal;font-family:var(--wmono);letter-spacing:.02em;color:var(--wgreen);border:1px solid rgba(46,224,106,.3);border-radius:3px;background:rgba(46,224,106,.06);vertical-align:middle;}
#dpicks td.nm .gtag.dim{color:var(--wf);border-color:var(--wbd2);background:transparent}
#prolist .wk-tbl2 td.nm .gtag.dim{color:var(--wf);border-color:var(--wbd2);background:transparent}
@media(max-width:700px){#wk-plan .wk-moves th:nth-child(3),#wk-plan .wk-moves td:nth-child(3),#wk-plan .wk-moves th:nth-child(4),#wk-plan .wk-moves td:nth-child(4),
#wk-plan .wk-moves th:nth-child(8),#wk-plan .wk-moves td:nth-child(8),#wk-plan .wk-moves th:nth-child(9),#wk-plan .wk-moves td:nth-child(9),
#wk-plan .wk-moves th:nth-child(10),#wk-plan .wk-moves td:nth-child(10){display:none}
#wk-plan .wk-moves table{table-layout:auto}#wk-plan .wk-moves col{width:auto!important}
#wk-plan .wk-moves td{padding:6px 4px}#wk-plan .wk-moves td.nm span{display:inline-block;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
/* ── one height for both panes in every state: the connected wallet pane's own
   (heading 30 + boxes 62+4 + rule 9 + heading 30 + eight rows 256, padding, border).
   The plan pane is a column that fits that height: the list takes the room, never
   fewer than four rows, and the moves stage scrolls inside when it is long ── */
#p-dele{--wk-h:409px}
#wk-mine,#wk-plan{height:var(--wk-h);max-height:var(--wk-h);box-sizing:border-box;overflow:hidden}
#wk-mine{display:flex;flex-direction:column}
#wk-mine #wk-acct{display:flex;flex-direction:column;min-height:0;flex:1 1 auto}

#wk-plan{display:flex;flex-direction:column}
#wk-plan>.wk-ph,#wk-plan>.wk-mvh{flex:0 0 auto}
#wk-plan .wk-tbl2,html:not([data-wallet]) #wk-plan .wk-tbl2{height:auto;max-height:none}
#wk-plan .wk-moves{flex:0 0 auto;min-height:0;max-height:170px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
#wk-plan .wk-moves thead th{position:sticky;top:0;background:var(--wc);z-index:1}
html:not([data-wallet]) .wk-two{align-content:normal}
html:not([data-wallet]) #wk-mine{align-self:auto}

/* the button and the two wallet squares share one box, both hanging from the same top
   edge, so the tap replaces one with the other and nothing above it moves */

/* ── the three titles: the wallet's sans face, a short bar of their own colour before
   each - cyan for your validators, green for the move, violet for what moves ── */
#wk-mine .wk-t1 h3,#wk-plan .wk-t2 h3,#wk-plan .wk-t3 h3,#wk-mv .wk-t3 h3{display:inline-flex;align-items:center;gap:8px;font-family:var(--wsans);font-size:13px;font-weight:600;letter-spacing:-.01em;text-transform:none;line-height:1}
#wk-mine .wk-t1 h3::before,#wk-plan .wk-t2 h3::before,#wk-plan .wk-t3 h3::before,#wk-mv .wk-t3 h3::before{content:"";width:3px;height:12px;border-radius:2px;background:currentColor;box-shadow:0 0 8px currentColor;opacity:.9}
#wk-mine .wk-t1 h3{color:#ffb02e}
#wk-plan .wk-t2 h3{color:var(--wgreen)}
#wk-plan .wk-t3 h3,#wk-mv .wk-t3 h3{color:#b9b0ff}
#wk-plan .wk-mvh::before{background:linear-gradient(90deg,#b9b0ff,transparent 60%)}
#wk-mine .wk-t1 .wk-pn,#wk-plan .wk-t3 .wk-pn,#wk-mv .wk-t3 .wk-pn{font-family:var(--wmono);font-size:9px;letter-spacing:.06em;color:var(--wf);margin-left:2px}
/* ── the list's column names as a band of their own: lit ground, hairlines above and
   below, a breath of space from the line above ── */

#dpicks thead th,#dstrat thead th{font-size:7.5px;letter-spacing:.14em;color:#c1bfdc;padding:8px 6px 7px;background:linear-gradient(180deg,#151530,#0f0f22);border-top:1px solid var(--wbd2);border-bottom:1px solid var(--wbd2);position:sticky;top:0;z-index:1}
#prolist .wk-tbl2 thead th{font-size:7.5px;letter-spacing:.14em;color:#c1bfdc;padding:8px 6px 7px;background:linear-gradient(180deg,#151530,#0f0f22);border-top:1px solid var(--wbd2);border-bottom:1px solid var(--wbd2);position:sticky;top:0;z-index:1}
#dpicks thead th:first-child,#dstrat thead th:first-child{border-left:1px solid var(--wbd2);border-radius:5px 0 0 5px}
#prolist .wk-tbl2 thead th:first-child{border-left:1px solid var(--wbd2);border-radius:5px 0 0 5px}
#dpicks thead th:last-child,#dstrat thead th:last-child{border-right:1px solid var(--wbd2);border-radius:0 5px 5px 0;padding-right:8px}
#prolist .wk-tbl2 thead th:last-child{border-right:1px solid var(--wbd2);border-radius:0 5px 5px 0;padding-right:8px}
#dpicks thead th.l,#dstrat thead th.l{padding-left:4px}
#prolist .wk-tbl2 thead th.l{padding-left:4px}
#dpicks thead th .lc{text-transform:none}
#prolist .wk-tbl2 thead th .lc{text-transform:none}   /* 90d, not 90D */
#dpicks tbody tr:first-child td,#dstrat tbody tr:first-child td{border-top:0}
#prolist .wk-tbl2 tbody tr:first-child td{border-top:0}
/* the head's own box: tick everyone; its word beside it */
#dpicks thead th.ck{text-align:left;white-space:nowrap}
#prolist .wk-tbl2 thead th.ck{text-align:left;white-space:nowrap}

#dpicks thead th.ck input{appearance:none;-webkit-appearance:none;width:15px;height:15px;margin:0;border-radius:4px;border:1px solid var(--wbd2);background:linear-gradient(180deg,#17172f,#0e0e1d);box-shadow:inset 0 1px 0 rgba(255,255,255,.05);cursor:pointer;position:relative;vertical-align:middle;transition:border-color .12s,box-shadow .12s,background .12s}
#prolist .wk-tbl2 thead th.ck input{appearance:none;-webkit-appearance:none;width:15px;height:15px;margin:0;border-radius:4px;border:1px solid var(--wbd2);background:linear-gradient(180deg,#17172f,#0e0e1d);box-shadow:inset 0 1px 0 rgba(255,255,255,.05);cursor:pointer;position:relative;vertical-align:middle;transition:border-color .12s,box-shadow .12s,background .12s}
#dpicks thead th.ck input:hover{border-color:var(--ws)}
#prolist .wk-tbl2 thead th.ck input:hover{border-color:var(--ws)}
#dpicks thead th.ck input:checked{background:linear-gradient(180deg,#3cf07a,#22c65c);border-color:#2ee06a;box-shadow:0 0 0 3px rgba(46,224,106,.14)}
#prolist .wk-tbl2 thead th.ck input:checked{background:linear-gradient(180deg,#3cf07a,#22c65c);border-color:#2ee06a;box-shadow:0 0 0 3px rgba(46,224,106,.14)}
#dpicks thead th.ck input:checked::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;border:solid #062012;border-width:0 2px 2px 0;transform:rotate(45deg)}
#prolist .wk-tbl2 thead th.ck input:checked::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;border:solid #062012;border-width:0 2px 2px 0;transform:rotate(45deg)}
#dpicks thead th.ck input:indeterminate{border-color:#2ee06a;background:linear-gradient(180deg,#17172f,#0e0e1d)}
#prolist .wk-tbl2 thead th.ck input:indeterminate{border-color:#2ee06a;background:linear-gradient(180deg,#17172f,#0e0e1d)}
#dpicks thead th.ck input:indeterminate::after{content:"";position:absolute;left:3px;right:3px;top:6px;height:2px;background:#2ee06a;border-radius:1px}
#prolist .wk-tbl2 thead th.ck input:indeterminate::after{content:"";position:absolute;left:3px;right:3px;top:6px;height:2px;background:#2ee06a;border-radius:1px}
#dpicks thead th.ck label{font-family:var(--wmono);font-size:7.5px;letter-spacing:.16em;text-transform:uppercase;color:#c1bfdc;margin-left:5px;vertical-align:middle;cursor:pointer}
#prolist .wk-tbl2 thead th.ck label{font-family:var(--wmono);font-size:7.5px;letter-spacing:.16em;text-transform:uppercase;color:#c1bfdc;margin-left:5px;vertical-align:middle;cursor:pointer}
/* ── three panes in one row, all the wallet pane's height, pushed to the left:
   the wallet, Redelegate, What moves ── */

#wk-mv{height:var(--wk-h);max-height:var(--wk-h);box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;--a:#b9b0ff}
#wk-mv .wk-mvh{margin:0;padding:0;border:0;flex:0 0 auto}
#wk-mv .wk-mvh::before{display:none}
#wk-mv .wk-moves{min-height:0;max-height:none;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
#wk-mv .wk-moves:empty{display:none}
#wk-mv .wk-mvempty{display:flex;align-items:center;justify-content:center;font-family:var(--wmono);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--wf);text-align:center;padding:0 20px}
#wk-mv .wk-mvempty[hidden]{display:none}
/* the moves as a list like the one beside it: from, to, the stake that moves, the gain */

#wk-mv .wk-moves table{width:100%;border-collapse:collapse;table-layout:fixed}
#wk-mv .wk-moves th{font-family:var(--wmono);text-transform:uppercase;font-weight:400;text-align:right;white-space:nowrap;padding:8px 5px 7px}
#wk-mv .wk-moves td{padding:0 5px;height:30px;border-bottom:1px solid #22223c;text-align:right;font-family:var(--wmono);font-size:10.5px;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;vertical-align:middle}
#wk-mv .wk-moves td.l,#wk-mv .wk-moves th.l{text-align:left}
#wk-mv .wk-moves td.nm .nmw{display:flex;align-items:center;gap:5px;min-width:0}
#wk-mv .wk-moves td.nm .nmw>span{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--wsans);font-size:11px;color:#fff8dc}
/* the initial-letter mark is a span too: it keeps its circle, only the name gives way */
#wk-mv .wk-moves td.nm .nmw>span.wk-lgx,#dpicks td.nm .nmw>span.wk-lgx{flex:0 0 15px;width:15px;height:15px;line-height:15px;font-size:7px;overflow:hidden;text-align:center;font-family:var(--wmono);color:#fff}
#prolist .wk-tbl2 td.nm .nmw>span.wk-lgx{flex:0 0 15px;width:15px;height:15px;line-height:15px;font-size:7px;overflow:hidden;text-align:center;font-family:var(--wmono);color:#fff}
#wk-mv .wk-moves .wk-lg,#wk-mv .wk-moves .wk-lgx{width:15px;height:15px;line-height:15px;font-size:7px;margin:0;flex:0 0 auto}
#wk-mv .wk-moves td.ar{text-align:center;color:var(--wgreen);font-size:12px;padding:0}
#wk-mv .wk-moves td.amt{color:#fff8dc}
#wk-mv .wk-moves td.gn{color:var(--wgreen)}
#wk-mv .wk-moves td.gn.dim,#wk-mv .wk-moves td.dim{color:var(--wf)}
#wk-mv .wk-moves td.gn i{font-style:normal;font-size:7px;letter-spacing:.08em;color:var(--wamber);margin-left:3px}
#wk-mv .wk-moves tr:hover td{background:#171730}
#wk-mv .wk-moves tr.stay td{color:var(--wf)}
#wk-mv .wk-moves thead th{position:sticky;top:0;z-index:1}
/* the Redelegate pane no longer holds the moves: its list takes the rest */
#wk-plan .wk-tbl2,html:not([data-wallet]) #wk-plan .wk-tbl2{flex:1 1 0;min-height:0}
@media(max-width:900px){#wk-mv{height:auto;max-height:none}}
/* ── the three heads on one line: 32px each, the wallet's name and address centred on
   the disconnect button, the Redelegate and What moves heads at the same height, and
   the first row of each pane starting at the same top ── */
#wk-mine .wk-bh,#wk-plan>.wk-ph,#wk-mv .wk-mvh{height:32px;min-height:32px;max-height:32px;padding:0;margin:0;display:flex;align-items:center;flex-wrap:nowrap;box-sizing:border-box}
#wk-mine .wk-bh .wk-addrw{margin:0;}

#wk-mv .wk-mvh h3,#wk-plan>.wk-ph h3{align-self:center}
/* the stake row in a narrower pane: field and button on the first line, the two
   figure boxes on their own line beneath, sharing the width */

#wk-plan .wk-field{flex:0 1 180px;width:180px;max-width:100%;min-width:120px}

/* the name cell: a flex wrapper INSIDE the cell (never the cell itself), so the name
   gives way and the gain tag keeps its place */
#dpicks td.nm .nmw{display:flex;align-items:center;gap:6px;min-width:0}
#prolist .wk-tbl2 td.nm .nmw{display:flex;align-items:center;gap:6px;min-width:0}
#dpicks td.nm .nmw>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#prolist .wk-tbl2 td.nm .nmw>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#dpicks td.nm .nmw .wk-lg,#dpicks td.nm .nmw .wk-lgx{flex:0 0 auto;margin:0}
#prolist .wk-tbl2 td.nm .nmw .wk-lg,#prolist .wk-tbl2 td.nm .nmw .wk-lgx{flex:0 0 auto;margin:0}

/* rows that would not beat your rate stay in the list, quieter, their "there" in grey */

#dpicks tbody tr.lt.on td{color:var(--ws)}
#prolist .wk-tbl2 tbody tr.lt.on td{color:var(--ws)}
/* the line lives in the title row, at its right end, as one quiet phrase */

/* the line sits right under the title; the stake row follows it */

/* the two figure boxes open the What moves pane, on the same top as the stake row */
#wk-mv .wk-ans{order:0;flex:0 0 auto;display:flex;}
#wk-mv .wk-ans .p{flex:2 1 0;justify-content:center;min-width:0;padding:0 5px;height:28px;gap:4px}

/* three boxes over the moves: the rate pair takes its own line, the gain and the
   21-day cooldown share the next */
#wk-mv .wk-ans{row-gap:6px}

#wk-mv .wk-ans .p.gain,#wk-mv .wk-ans .p.lock{flex:1 1 0}
#wk-mv .wk-ans .p.lock{--c:#ffb02e}
#wk-mv .wk-ans .p.lock b{color:#ffb02e}
#p-dele #wk-mv .wk-ans .p.lock svg{max-height:none;fill:none;stroke:#ffb02e;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
/* the stake row as three columns: the phrase, the field, the button */

/* stake under cooldown: an amber note at the end of the Redelegate title row */
#wk-plan>.wk-ph .wk-lockn{height:22px;display:inline-flex;align-items:center;gap:4px;padding:0 6px;border-radius:5px;border:1px solid rgba(255,176,46,.35);background:rgba(255,176,46,.06);font-family:var(--wmono);font-size:7px;letter-spacing:.06em;text-transform:uppercase;color:var(--wamber);white-space:nowrap;flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
#wk-plan>.wk-ph .wk-lockn b{font-size:9.5px;font-weight:400;letter-spacing:0;color:#ffd58a}
#wk-plan>.wk-ph .wk-lockn[hidden]{display:none}
/* the same note in the Redelegate popup's first row, centred between the title and the sum: the header is three
   columns (title | note | sum) so the note sits in the card's middle whatever the two sides measure; empty, it
   takes no room and the row reads as before */
#txpop .wk-txh{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px}
#txpop .wk-txh .txsum{grid-column:3;justify-self:end;text-align:right}
#txpop .txlockn:empty{display:none}
#txpop .txlockn{grid-column:2;height:24px;display:inline-flex;align-items:center;gap:5px;margin:0;padding:0 8px;border-radius:6px;border:1px solid rgba(255,176,46,.35);background:rgba(255,176,46,.06);font-family:var(--wmono);font-size:8px;letter-spacing:.06em;text-transform:uppercase;color:var(--wamber);white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
#txpop .txlockn b{display:inline;font-size:10px;font-weight:400;letter-spacing:0;color:#ffd58a}
#txpop .txlockn svg{width:11px;height:11px;flex:0 0 auto;fill:none;stroke:#ffb02e;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
/* a phone has no middle to spare: title and sum keep the first row, the note takes a centred line of its own */
@media(max-width:600px){#txpop .wk-txh{grid-template-columns:minmax(0,1fr) auto;row-gap:8px}#txpop .wk-txh .txsum{grid-column:2;grid-row:1}
  #txpop .txlockn{grid-column:1/-1;grid-row:2;justify-self:center;max-width:100%}}
/* max with nothing to move: grey, inert */
#wk-plan .wk-field .wk-max:disabled{opacity:.45;cursor:default;border-color:var(--wbd);background:transparent;color:var(--wf)}
#wk-plan .wk-field .wk-max:disabled b{color:var(--wf)}
#wk-plan .wk-field .wk-max:disabled:hover{border-color:var(--wbd);background:transparent;color:var(--wf)}
/* room for the decimal: the balance figures a touch tighter; the clock yields to the
   cooldown note in the title row */

/* the empty delegations line: small, plain, a little in from the edge */
#dmy .wk-empty{font-family:var(--wmono);font-size:9px;font-weight:400;letter-spacing:.12em;text-transform:uppercase;color:var(--wf);}
/* the pane's line at the right end of its title row: one chip in the "would earn you
   more" shape, in the pane's own colours */

/* ── unstake: a door in the Delegations head, a card of its own ── */
#wk-mine .wk-t1 .wk-unb{margin-left:auto;border:1px solid rgba(255,176,46,.4);background:linear-gradient(180deg,#1a1730,#12101f);color:var(--wamber);flex:0 0 auto;}
#wk-mine .wk-t1 .wk-unb:hover{border-color:var(--wamber);}

#wk-mine .wk-t1 .wk-unb[hidden]{display:none}
#wk-mine .wk-t1 .wk-foot:empty{display:none}
#wk-mine .wk-t1 .wk-foot:not(:empty){margin-left:auto}
#wk-mine .wk-t1 .wk-foot:not(:empty)+.wk-unb{margin-left:8px}
.uncard{width:min(440px,94vw)}
.uncard .unpick{padding:10px 20px 0;max-height:216px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
.uncard .unrow{display:grid;grid-template-columns:18px 16px minmax(0,1fr) auto;align-items:center;gap:8px;height:34px;padding:0 8px;border:1px solid var(--wbd);border-radius:6px;background:linear-gradient(180deg,#10101f,#0b0b18);margin-bottom:5px;cursor:pointer;transition:border-color .12s,background .12s}
.uncard .unrow:hover{border-color:var(--ws)}
.uncard .unrow.on{border-color:var(--wamber);background:linear-gradient(180deg,#1c1830,#12101f);box-shadow:0 0 0 3px rgba(255,176,46,.1)}
.uncard .unrow input{appearance:none;-webkit-appearance:none;width:14px;height:14px;margin:0;border-radius:50%;border:1px solid var(--wbd2);background:var(--wi);position:relative;cursor:pointer}
.uncard .unrow input:checked{border-color:var(--wamber)}
.uncard .unrow input:checked::after{content:"";position:absolute;left:3px;top:3px;width:6px;height:6px;border-radius:50%;background:var(--wamber);box-shadow:0 0 8px var(--wamber)}
.uncard .unrow .wk-lg,.uncard .unrow .wk-lgx{width:16px;height:16px;line-height:16px;font-size:7px;margin:0}
.uncard .unrow b{font-family:var(--wsans);font-size:12px;font-weight:400;color:#fff8dc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.uncard .unrow i{font-style:normal;font-family:var(--wmono);font-size:10.5px;color:var(--ws);font-variant-numeric:tabular-nums;white-space:nowrap}
.uncard .unrow i em{font-style:normal;font-size:7px;letter-spacing:.12em;text-transform:uppercase;color:var(--wf);margin-left:5px}
.uncard .unamt{display:flex;align-items:center;gap:10px;padding:12px 20px 0}
/* Stake: the amount and the count above the list, as Redelegate's title row holds them */
.stcard .unamt.sttop{padding-top:10px;padding-bottom:10px}
.uncard .unfield{width:200px;height:30px;display:inline-flex;align-items:center;padding:0 4px 0 0;border-radius:6px;border:1px solid var(--wbd2);background:linear-gradient(180deg,#0b0b18,#0e0e1d);box-shadow:inset 0 1px 0 #ffffff06;transition:border-color .15s,box-shadow .15s}
.uncard .unfield:focus-within{border-color:#b9b0ff;box-shadow:0 0 0 3px rgba(185,176,255,.13)}
.uncard .unfield.bad,.uncard .unfield.bad:focus-within{border-color:var(--wburn)!important;background:rgba(255,77,31,.1)!important;box-shadow:0 0 0 3px rgba(255,77,31,.2)!important}
.uncard .unfield.bad input{color:#ff8a6a!important}
.uncard .unfield input.wk-amt2{flex:1 1 auto;min-width:0;height:100%;padding:0 10px;margin:0;border:0;background:transparent;color:#fff8dc;font-family:var(--wmono);font-size:12.5px;outline:none;box-shadow:none;-webkit-appearance:none;appearance:none}
.uncard .unfield input.wk-amt2:focus,.uncard .unfield input.wk-amt2:focus-visible{box-shadow:none;outline:none}
.uncard .unfield input.wk-amt2::placeholder{font-family:var(--wmono);font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf);opacity:.8}
.uncard .unfield .wk-max{height:22px;padding:0 8px;border-radius:4px;border:1px solid var(--wbd2);background:#13132a;color:var(--wf);font-family:var(--wmono);font-size:7.5px;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;gap:5px;flex:0 0 auto}
.uncard .unfield .wk-max b{font-size:9.5px;color:var(--ws);font-weight:400}
.uncard .unfield .wk-max:hover{color:var(--wt);border-color:var(--ws)}
.uncard .unfield .wk-max:disabled{opacity:.45;cursor:default}
.uncard .unhint{font-family:var(--wmono);font-size:8.5px;letter-spacing:.06em;color:var(--wf);white-space:nowrap}
.uncard .unhint.bad{color:var(--wburn)}
.uncard .txlock{padding-top:12px}
.uncard .wk-btn.wk-go{background:linear-gradient(180deg,#ffc453,#e69a17);border:1px solid #ffb02e;color:#1d1200;box-shadow:0 10px 24px -12px rgba(255,176,46,.7),inset 0 1px 0 rgba(255,255,255,.3)}
.uncard .wk-btn.wk-go:hover{filter:brightness(1.06)}
.uncard .wk-btn.wk-go:disabled{background:linear-gradient(180deg,#1d1d36,#15152a);border-color:#2f2f52;color:#66648c;box-shadow:none;filter:none;opacity:1}
.uncard .unrow.all{border-color:rgba(255,176,46,.35);background:linear-gradient(90deg,rgba(255,176,46,.08),transparent 70%)}
.uncard .unrow.all b{color:var(--wamber)}
.uncard .unrow.all .wk-lgx{background:#3a2a10;color:var(--wamber)}
/* the two ends the same 360px, Redelegate the room between; the wallet's table and boxes
   sized for 336px inside */

/* the cards keep their height: the fee line and the step line have their room before
   they are filled, so nothing below them moves */
#txpop .txfee,#unpop .txfee,#clpop .txfee,#stpop .txfee{height:23px;min-height:23px;line-height:13px;overflow:hidden;white-space:nowrap}
#txpop .txstep,#unpop .txstep,#clpop .txstep,#stpop .txstep{min-height:20px}
@media(max-width:900px){
  .wk-two{align-content:start;grid-auto-rows:max-content}
  #wk-mine,#wk-plan,#wk-mv{height:auto;max-height:none;overflow:hidden}
  html:not([data-wallet]) #wk-mine{align-self:auto}
  
  #wk-plan .wk-tbl2,html:not([data-wallet]) #wk-plan .wk-tbl2{flex:0 0 auto;height:calc(16px + 8 * 30px)}
  #wk-mv .wk-moves{max-height:calc(16px + 6 * 30px)}
  #wk-mv .wk-mvempty{min-height:70px}

/* the address chip stays on the name line (it fits) instead of a hidden second line */
  
  #wk-mine .wk-bh .wk-addrw{order:0;flex:0 1 auto;}
  #wname .nf{display:none}#wname .ns{display:inline!important}
  #waddr .af{display:none}#waddr .ap{display:inline!important}
  
  #wk-mine .wk-bh .wk-addrw{padding-left:6px}
}
#wname .ns{display:none}
#waddr .ap{display:none}
/* the word beside the glyph, so the button reads at a glance; the phone keeps it short */

/* ── alerts from the stake and redelegate cards: the bell at the left of the button
   row; the chooser lists the validators it covers ── */
.txbtns .wk-bell{margin-right:auto;display:inline-flex;align-items:center;gap:6px;color:var(--wamber);border-color:rgba(255,176,46,.35);background:transparent}
.txbtns .wk-bell:hover{border-color:var(--wamber);color:#ffd58a}
.txbtns .wk-bell:disabled{opacity:.4;cursor:default}
#txpop .txbtns .wk-bell svg,#stpop .txbtns .wk-bell svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;margin:0;max-height:none}
.acard .amany{display:flex;flex-wrap:wrap;gap:5px;padding:0 24px 2px}
.acard .amany[hidden]{display:none}
.acard .amany span{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px 0 4px;border:1px solid var(--edge2,#34345c);border-radius:5px;background:#0b0b16;font-size:11px;color:var(--ink,#e6e4f0);white-space:nowrap}
.acard .amany span img,.acard .amany span i{width:14px;height:14px;border-radius:50%;display:inline-block;font-style:normal;font-size:7px;line-height:14px;text-align:center;color:#fff;font-family:var(--mono)}
.acard .amany span.more{color:var(--ink3,#6f6d94);border-style:dashed}
.acard .amore{padding:0 24px}
.acard .amore[hidden]{display:none}
.acard .amore a{display:flex;align-items:center;justify-content:center;gap:8px;margin:8px 0 0;height:36px;border-radius:8px;border:1px solid var(--edge2,#34345c);color:var(--ink,#e6e4f0);text-decoration:none;font-size:12px}
.acard .amore a.off{opacity:.45;pointer-events:none}
.acard .amore small{display:block;margin-top:6px;font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3,#6f6d94);text-align:center}
/* ── the unstake card, composed: an amber line along its top, a summary strip under the
   head (what leaves, from where, when it is back), the rows, the field row, the note ── */
.pop .card.uncard{position:relative;overflow:hidden;border-radius:10px;background:linear-gradient(180deg,#11111f,#0c0c19);box-shadow:0 40px 90px -40px #000,inset 0 1px 0 rgba(255,255,255,.04)}
.pop .card.stcard::before{content:"";position:absolute;left:24px;right:24px;top:0;height:1px;opacity:.9}
.uncard .wk-txh{padding:16px 20px 10px}
.uncard .wk-txh b{color:#fff8dc}
.uncard .txsum{color:var(--wamber)}

.uncard .unpick{padding-top:12px}
.uncard .unamt{padding-top:10px}
.stcard .txlock{margin:12px 20px 0;padding:9px 12px;border:1px solid rgba(255,176,46,.28);border-radius:6px;display:flex;align-items:center;gap:8px}
.stcard .txlock span{font-family:var(--wmono);font-size:8.5px;letter-spacing:.04em;color:var(--ws);line-height:1.4}
.stcard .txlock span b{font-weight:400}
#p-dele .stcard .txlock svg,.stcard .txlock svg{width:12px;height:12px;flex:0 0 auto;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;margin:0}
.uncard .txfee{padding:10px 20px 0;color:var(--wf)}
.uncard .txbtns{padding:14px 20px 18px;border-top:1px solid var(--wbd);margin-top:12px}
.uncard .wk-btn{height:32px;border-radius:6px;font-family:var(--wmono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;font-weight:400}
/* ── stake: the green door before Unstake, its card in green ── */
#wk-mine .wk-t1 .wk-unb.wk-stb{margin-left:auto;}

#wk-mine .wk-t1 .wk-stb+.wk-unb{margin-left:6px}
#wk-mine .wk-t1 .wk-foot:not(:empty)+.wk-stb{margin-left:8px}
#wk-mine .wk-t1 .wk-stb[hidden]{display:none}
.pop .card.stcard{width:min(520px,94vw);max-width:520px;max-height:92vh;max-height:92svh}
.pop .card.stcard::before{background:linear-gradient(90deg,transparent,var(--wgreen),transparent)}
.stcard .txsum{color:var(--wgreen)}

.stcard .stlist{margin:12px 20px 0;max-height:max(100px,calc(92vh - 322px));max-height:max(100px,calc(92svh - 322px));overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent;flex:0 0 auto}
.stcard .stlist table{width:100%;border-collapse:collapse;table-layout:fixed}
.stcard .stlist thead th{font-family:var(--wmono);font-size:7.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:400;color:#c1bfdc;text-align:right;white-space:nowrap;padding:8px 5px 7px;background:linear-gradient(180deg,#151530,#0f0f22);border-top:1px solid var(--wbd2);border-bottom:1px solid var(--wbd2);position:sticky;top:0;z-index:1}
.stcard .stlist thead th:first-child{border-left:1px solid var(--wbd2);border-radius:5px 0 0 5px}
.stcard .stlist thead th:last-child{border-right:1px solid var(--wbd2);border-radius:0 5px 5px 0}
.stcard .stlist th.l,.stcard .stlist td.l{text-align:left}
.stcard .stlist td{padding:0 5px;height:30px;border-bottom:1px solid #22223c;text-align:right;font-family:var(--wmono);font-size:10.5px;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;font-variant-numeric:tabular-nums}
.stcard .stlist tr:hover td{background:#171730}
.stcard .stlist tr.on td{background:rgba(46,224,106,.045)}
.stcard .stlist tr.on td:first-child{box-shadow:inset 2px 0 0 var(--wgreen)}
.stcard .stlist td.nm .nmw{display:flex;align-items:center;gap:6px;min-width:0}
.stcard .stlist td.nm .nmw>span{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--wsans);font-size:11px;color:#fff8dc}
.stcard .stlist td.nm .nmw>span.wk-lgx{flex:0 0 15px;width:15px;height:15px;line-height:15px;font-size:7px;text-align:center;font-family:var(--wmono);color:#fff}
.stcard .stlist .wk-lg{width:15px;height:15px;margin:0;flex:0 0 auto}
.stcard .stlist td.ok{color:var(--wgreen)}.stcard .stlist td.warn{color:var(--wamber)}.stcard .stlist td.bad{color:var(--wburn)}.stcard .stlist td.dim{color:var(--wf)}
.stcard .stlist td.r2 b{font-weight:400;color:var(--wgreen)}
.stcard .stlist td.ck{padding:0 0 0 4px}
.stcard .stlist td.ck input{appearance:none;-webkit-appearance:none;width:15px;height:15px;margin:0;border-radius:4px;border:1px solid var(--wbd2);background:linear-gradient(180deg,#17172f,#0e0e1d);cursor:pointer;position:relative;vertical-align:middle}
.stcard .stlist td.ck input:checked{background:linear-gradient(180deg,#3cf07a,#22c65c);border-color:#2ee06a;box-shadow:0 0 0 3px rgba(46,224,106,.14)}
.stcard .stlist td.ck input:checked::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;border:solid #062012;border-width:0 2px 2px 0;transform:rotate(45deg)}
.stcard .unfield:focus-within{border-color:var(--wgreen);box-shadow:0 0 0 3px rgba(46,224,106,.13)}
.stcard .txlock{border-color:rgba(46,224,106,.28);background:rgba(46,224,106,.05)}
.stcard .txlock span b{color:var(--wgreen)}
#p-dele .stcard .txlock svg,.stcard .txlock svg{stroke:var(--wgreen)}
.stcard .wk-btn.wk-go{background:linear-gradient(180deg,#34e874,#1db85a);border:1px solid #2ee06a;color:#04150a;box-shadow:0 10px 24px -12px rgba(46,224,106,.75),inset 0 1px 0 rgba(255,255,255,.3)}
.stcard .wk-btn.wk-go:disabled{background:linear-gradient(180deg,#1d1d36,#15152a);border-color:#2f2f52;color:#66648c;box-shadow:none}
#p-dele #wk-plan>.wk-ph .wk-lockn svg{width:9px;height:9px;margin:0 1px 0 0;max-height:none;fill:none;stroke:var(--wamber);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}
@media(max-width:700px){#wk-plan>.wk-ph .wk-lockn{font-size:6.5px;padding:0 6px}#wk-plan>.wk-ph .wk-lockn .w{display:none}#wk-plan>.wk-ph .wk-lockn b:last-of-type::before{content:"\2192";margin:0 2px;color:var(--wamber)}}
/* ── every pane has a floor: the list fades out over its last pixels and a hairline
   closes the section above the pane's edge, so nothing falls off the bottom ── */
#wk-mine,#wk-plan,#wk-mv{padding-bottom:14px}
#wk-mine::after,#wk-plan::after,#wk-mv::after{content:"";position:absolute;left:12px;right:12px;bottom:9px;height:1px;background:linear-gradient(90deg,transparent,var(--wbd2) 10%,var(--wbd2) 90%,transparent);pointer-events:none}
#dmy,#dpicks,#dstrat{-webkit-mask-image:linear-gradient(180deg,#000 calc(100% - 14px),transparent);mask-image:linear-gradient(180deg,#000 calc(100% - 14px),transparent)}
#prolist .wk-tbl2{-webkit-mask-image:linear-gradient(180deg,#000 calc(100% - 14px),transparent);mask-image:linear-gradient(180deg,#000 calc(100% - 14px),transparent)}

/* the name carries the titles' bar too (positioned, so ::first-letter still capitalises) */
#wk-mine .wk-bh h3::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;border-radius:2px;background:currentColor;box-shadow:0 0 8px currentColor;opacity:.9}

/* the three figures as one row of stacked boxes, the balance boxes' shape */
#wk-mv .wk-ans{flex-wrap:nowrap;gap:6px;margin:4px 0 0}
#wk-mv .wk-ans .p,#wk-mv .wk-ans .p.rate,#wk-mv .wk-ans .p.gain,#wk-mv .wk-ans .p.lock{flex:1 1 0;min-width:0;height:46px;padding:0 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
#wk-mv .wk-ans .p.rate{flex:1.25 1 0}
#wk-mv .wk-ans .p.lock{flex:1.2 1 0}
#wk-mv .wk-ans .p i{font-size:6.5px;letter-spacing:.14em;white-space:nowrap}
#wk-mv .wk-ans .p b{font-size:12px;letter-spacing:-.02em;white-space:nowrap}
#wk-mv .wk-ans .p .arr{font-size:10px;margin:0 1px}
/* the rate pair: one label over the two figures */
#wk-mv .wk-ans .p.rate{flex-flow:row wrap;column-gap:3px;row-gap:3px;align-content:center}
#wk-mv .wk-ans .p.rate i{flex:0 0 auto}
#wk-mv .wk-ans .p.rate i:first-child{flex:1 1 100%;text-align:center}
#wk-mv .wk-ans .p.rate i:first-child::after{content:" \2192  after"}
#wk-mv .wk-ans .p.rate i:not(:first-child){display:none}
#p-dele #wk-mv .wk-ans .p.lock svg{width:9px;height:9px;margin:0 2px 0 0}
#wk-mv .wk-ans .p.lock i{display:inline-flex;align-items:center}

#dpicks td.r2{letter-spacing:-.02em}
#prolist .wk-tbl2 td.r2{letter-spacing:-.02em}#dpicks td.r2 em{margin:0 2px}
#prolist .wk-tbl2 td.r2 em{margin:0 2px}
#dpicks thead th,#dpicks td{padding-left:5px;padding-right:5px}
#prolist .wk-tbl2 thead th,#prolist .wk-tbl2 td{padding-left:5px;padding-right:5px}

/* ── detailing: the wallet's controls share one ground (a lit gradient, an inset
   highlight, a hairline), one hover (the pane's accent), one press (a 4% shrink) ── */
#wk-plan .wk-ph .wk-ib,#wk-plan .wk-field .wk-max{
background:linear-gradient(180deg,#17172f,#0e0e1d);border:1px solid var(--wbd2);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 1px 2px rgba(0,0,0,.4);
transition:color .16s,border-color .16s,box-shadow .16s,transform .12s}
#wk-plan .wk-ph .wk-ib:active,#wk-plan .wk-field .wk-max:active{transform:scale(.94)}
/* refresh: smaller than disconnect, the arc turns once on every tap and keeps
   turning while the chain is being read */
#wk-plan .wk-ph .wk-ib{width:18px;height:18px;border-radius:4px;color:var(--ws)}
#p-dele #wk-plan .wk-ph .wk-ib svg{width:10px;height:10px;stroke-width:2.4}
#wk-plan .wk-ph .wk-ib:hover{color:#fff8dc;border-color:var(--a);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 12px -3px var(--a)}
#wk-plan .wk-ph .wk-ib.spun svg{animation:wkspin .55s cubic-bezier(.3,.6,.3,1) 1}
#wk-plan .wk-ph .wk-ib.busy{color:var(--wgreen);border-color:rgba(46,224,106,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 12px -3px rgba(46,224,106,.8)}
#wk-plan .wk-ph .wk-ib.busy svg{animation:wkspin .8s linear infinite}
#wk-plan .wk-ph .wk-ago{color:var(--wgreen);opacity:.95}
/* disconnect: the mark, a hairline, the leave glyph */

/* the tick: a lit square, a green one when on, the row it sits in warmed */
.wk-tbl2 td.ck input{width:15px;height:15px;border-radius:4px;border-color:var(--wbd2);background:linear-gradient(180deg,#17172f,#0e0e1d);box-shadow:inset 0 1px 0 rgba(255,255,255,.05);transition:border-color .12s,box-shadow .12s,background .12s}
.wk-tbl2 td.ck input:hover{border-color:var(--ws)}
.wk-tbl2 td.ck input:checked{background:linear-gradient(180deg,#3cf07a,#22c65c);border-color:#2ee06a;box-shadow:0 0 0 3px rgba(46,224,106,.14),0 0 10px -2px rgba(46,224,106,.7)}
.wk-tbl2 td.ck input:checked::after{left:4.5px;top:1.5px;width:4px;height:8px}
#dpicks tbody tr.on td{background:rgba(46,224,106,.045)}
#prolist .wk-tbl2 tbody tr.on td{background:rgba(46,224,106,.045)}
#dpicks tbody tr.on td:first-child{box-shadow:inset 2px 0 0 var(--wgreen)}
#prolist .wk-tbl2 tbody tr.on td:first-child{box-shadow:inset 2px 0 0 var(--wgreen)}
/* a delegation row is a door: the accent bar shows on hover, the name brightens */
#dmy tbody tr[data-v]:hover td:first-child{box-shadow:inset 2px 0 0 var(--a)}
#dmy tbody tr[data-v]:hover td.nm span{color:#fff8dc}
/* Redelegate: filled and lit when it can be signed, a ghost until then */

@media(prefers-reduced-motion:reduce){#wk-plan .wk-ph .wk-ib.spun svg,#wk-plan .wk-ph .wk-ib.busy svg{animation:none}}
/* the heading: name, the whole address with a copy glyph after it, the wallet's
   button at the opposite edge; on a phone the address takes its own line */
#wk-mine .wk-bh{flex-wrap:wrap;row-gap:2px}

#wk-mine .wk-bh h3::first-letter{text-transform:uppercase}
#wk-mine .wk-bh .wk-addr{overflow:hidden;text-overflow:ellipsis}

/* the soon badge sits over the Governance word: centred on it, its lower half
   across the word's upper half */

/* Balance: the account's own name stands as the heading, its address after it;
   then five centred figures on a lit ground */
#wk-mine .wk-bh{display:flex;gap:10px;padding-bottom:2px}
/* the account name: the sans face, larger, amber with a soft glow - the pane's own heading */
#wk-mine .wk-bh h3{font-family:var(--wsans);font-weight:600;text-transform:none;color:#f0eef8;text-shadow:none;line-height:1;padding:0 0 0 11px;position:relative;align-self:center;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#wk-mine .wk-bh .wk-addr{font-style:normal;text-transform:none;}

#wk-mine .wk-b5{text-align:center;
border-color:var(--wbd2);}

#wk-mine .wk-b5 i{justify-content:center;}

#wk-mine .wk-b5 b#ds-apr{color:#ffb02e}
@media(max-width:700px){#wk-mine .wk-bh h3{max-width:120px}}

.wk-rule{height:1px;margin:0 -12px 8px;background:linear-gradient(90deg,transparent,var(--wbd2) 12%,var(--wbd2) 88%,transparent)}
/* the account, small, at the top right of the section - under the Wallet word in the bar */

/* redelegation head: title, refresh, seconds ago; the account at the right */
#wk-plan .wk-ph .wk-ib{margin-left:10px}
#wk-plan .wk-ph .wk-ago{margin-left:8px}

/* delegations: eight rows in view, the rest by scrolling inside; the header stays */
/* eight rows tall always (head 16 + 8 x 30) - fewer delegations leave the room, more scroll inside */
#wk-mine .wk-tbl2{flex:0 0 auto;height:calc(16px + 8 * 30px);max-height:none;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
#wk-mine .wk-tbl2 thead th{position:sticky;top:0;background:var(--wc);z-index:1}
#wk-mine .wk-pf{display:none}

/* the phone bar: the mark, two words, the wallet as its glyph alone */
/* ── the section fills the calculator's frame: the wallet down the left to the floor,
   Redelegate over Outcome on the right (rows named, not equal - 1.35 : 1) ── */
@media(min-width:901px){
  /* absolutely placed in the body so its height is definite and the fr rows fill it */
  #wbody{position:relative;flex:1 1 auto;min-height:0}
  .wk-two{position:absolute;left:0;right:0;top:0;bottom:0;height:auto;grid-template-columns:360px minmax(0,1fr);align-content:stretch;align-items:stretch;justify-content:stretch;gap:10px}
  #wk-mine{height:auto;max-height:none;align-self:stretch}
  #wk-plan{height:auto;max-height:none;min-height:0}
  #wk-mv{height:auto;max-height:none;min-height:0}
  html:not([data-wallet]) .wk-two{align-content:stretch}
  html:not([data-wallet]) #wk-mine{align-self:stretch}
  
  /* the delegations take the wallet's extra room, eight rows at the least */
  #wk-mine #wk-acct{flex:1 1 auto;min-height:0}
  #wk-mine .wk-tbl2{flex:1 1 auto;height:auto;max-height:none}
  #wk-plan .wk-tbl2,html:not([data-wallet]) #wk-plan .wk-tbl2{flex:1 1 0;height:auto;min-height:calc(16px + 4 * 30px)}
  #wk-mv .wk-moves{max-height:none;min-height:0}
  
}
/* ── Dashboard: the third word in the bar, beside Governance, one of the nav ── */

/* ── the tagline in the Redelegate head, between the clock and the cooldown note; the
   Outcome head carries its three figures as small chips at the right ── */

#wk-mv .wk-mvh .wk-ans{margin:0 0 0 auto;flex:0 1 auto;min-width:0;display:flex;flex-wrap:nowrap;gap:5px;order:0}
#wk-mv .wk-mvh .wk-ans .p,#wk-mv .wk-mvh .wk-ans .p.rate,#wk-mv .wk-mvh .wk-ans .p.gain,#wk-mv .wk-mvh .wk-ans .p.lock{flex:0 0 auto;height:22px;padding:0 7px;flex-direction:row;flex-flow:row nowrap;align-items:center;gap:4px;min-width:0}
#wk-mv .wk-mvh .wk-ans .p i{font-size:6.5px;letter-spacing:.12em;display:inline-flex;align-items:center}
#wk-mv .wk-mvh .wk-ans .p i:first-child{flex:0 0 auto;text-align:left}
#wk-mv .wk-mvh .wk-ans .p.rate i:first-child::after{content:none}
#wk-mv .wk-mvh .wk-ans .p.rate i:not(:first-child){display:inline-flex}
#wk-mv .wk-mvh .wk-ans .p b{font-size:11px;letter-spacing:-.02em}
#wk-mv .wk-mvh .wk-ans .p .arr{font-size:10px;margin:0 1px}
#wk-mv .wk-moves{margin-top:4px}
@media(max-width:700px){#wk-mv .wk-mvh{flex-wrap:wrap}#wk-mv .wk-mvh .wk-ans{flex:1 1 100%;order:3;margin:4px 0 0}}
/* ── the wallet head: the name large with DISCONNECT tall beside it, the address on its
   own line beneath, then the five figures as one ruled strip instead of boxes ── */

/* the figures: one strip, hairlines above and below, thin dividers between, value over label */
#wk-mine .wk-bal5{border-top:1px solid var(--wbd2);border-bottom:1px solid var(--wbd2)}
#wk-mine .wk-b5{flex:1 1 0;min-width:0;display:flex;align-items:center;position:relative;}

#wk-mine .wk-b5 b{line-height:1}

#wk-mine .wk-b5 b::after{display:block;width:14px;height:2px;border-radius:1px;margin:5px auto 0;background:var(--c,#6f66c8);opacity:.9}
#wk-mine .wk-b5:nth-child(1){--c:#b9b0ff}#wk-mine .wk-b5:nth-child(2){--c:#2bc8bd}#wk-mine .wk-b5:nth-child(3){--c:#6f66c8}#wk-mine .wk-b5:nth-child(4){--c:#2ee06a}#wk-mine .wk-b5:nth-child(5){--c:#ffb02e}

@media(max-width:700px){#wk-mine .wk-bal5{margin-top:8px}}
/* ── the two lines of the stake row, one style: 28px chips, the sans face, a number or
   a lead in colour, the rest in the pane's ink; the green one grows, the violet one holds ── */

/* ── the stake row: the two lines, the field, then the three figure chips (they wrap to a
   second line when the row is short); Redelegate stands at the Outcome head's right ── */

#wk-mv .wk-mvh .wk-btn.wk-go{font-family:var(--wmono);text-transform:uppercase;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;
transition:filter .15s,transform .12s}

#wk-mv .wk-mvh .wk-btn.wk-go:disabled{transform:none;filter:none;opacity:1;cursor:default}

/* ── the Redelegate list at its new width: taller rows, larger figures, clearer names ── */
#dpicks thead th{font-size:8px;letter-spacing:.16em;padding:9px 7px 8px;color:#d0cee6}
#prolist .wk-tbl2 thead th{font-size:8px;letter-spacing:.16em;padding:9px 7px 8px;color:#d0cee6}
#dpicks thead th.ck{padding:0 0 0 6px}
#prolist .wk-tbl2 thead th.ck{padding:0 0 0 6px}
#dpicks td{height:32px;padding:0 7px;font-size:11px}
#prolist .wk-tbl2 td{height:32px;padding:0 7px;font-size:11px}
#dpicks td.nm .nmw>span{font-size:12px}
#prolist .wk-tbl2 td.nm .nmw>span{font-size:12px}
#dpicks td.nm .nmw .wk-lg,#dpicks td.nm .nmw>span.wk-lgx{width:17px;height:17px;line-height:17px;flex-basis:17px}
#prolist .wk-tbl2 td.nm .nmw .wk-lg,#prolist .wk-tbl2 td.nm .nmw>span.wk-lgx{width:17px;height:17px;line-height:17px;flex-basis:17px}
#dpicks td.r2{font-size:10.5px}
#prolist .wk-tbl2 td.r2{font-size:10.5px}
#dpicks td.r2 b{font-size:11.5px}
#prolist .wk-tbl2 td.r2 b{font-size:11.5px}
#dpicks td.ok{color:var(--wgreen)}
#prolist .wk-tbl2 td.ok{color:var(--wgreen)}#dpicks td.warn{color:var(--wamber)}
#prolist .wk-tbl2 td.warn{color:var(--wamber)}#dpicks td.bad{color:var(--wburn)}
#prolist .wk-tbl2 td.bad{color:var(--wburn)}#dpicks td.dim{color:var(--wf)}
#prolist .wk-tbl2 td.dim{color:var(--wf)}
#dpicks tbody tr.lt td.ok,#dpicks tbody tr.lt td.warn,#dpicks tbody tr.lt td.bad{color:var(--wf)}
#prolist .wk-tbl2 tbody tr.lt td.ok,#prolist .wk-tbl2 tbody tr.lt td.warn,#prolist .wk-tbl2 tbody tr.lt td.bad{color:var(--wf)}
#dpicks td.nm .gtag{font-size:8.5px;padding:1px 5px}
#prolist .wk-tbl2 td.nm .gtag{font-size:8.5px;padding:1px 5px}
/* the line in the Outcome head, before the button, in the stake row's style */

/* ── the account block: one framed block at the head's right, two rows - DISCONNECT over
   the address with its copy glyph - the address as wide as the button; the name at the
   left stands on the block's centre line. The balances are five readable tiles ── */
#wk-mine .wk-bh{align-items:center}

/* five tiles, larger figures, in two rows: the wallet's tokens, then what is staked, earned, paid */
#wk-mine .wk-bal5{display:grid;gap:6px;margin:10px 0 0;padding:0;border:0}
#wk-mine .wk-b5{grid-column:span 2;flex-direction:column;border:1px solid var(--wbd2);border-radius:6px;background:linear-gradient(180deg,#12122a,#0b0b18);box-shadow:inset 0 1px 0 #ffffff08;overflow:hidden}
#wk-mine .wk-b5::before{content:"";position:absolute;left:10px;right:10px;top:0;height:1px;background:linear-gradient(90deg,transparent,var(--c,#6f66c8),transparent);opacity:.9}
#wk-mine .wk-b5+.wk-b5{border-left:1px solid var(--wbd2)}
#wk-mine .wk-b5:nth-child(4){grid-column:1/4}#wk-mine .wk-b5:nth-child(5){grid-column:4/7}

#wk-mine .wk-b5 b::after{content:none}

#wk-mine .wk-rule{margin-top:10px}

/* ── the Dashboard sits exactly where the calculator pane sits: the same top under the
   title band, the same height - the flipbox's own box, measured by state() ── */
@media(min-width:901px){
  .w#calc{position:relative}
  /* the sub-header stands in the row the brandbar had, so the pane starts where the
     calculator's content starts: the same top, the same height, on both tabs */
  html[data-tab=dele] .w#calc>#p-dele,html[data-tab=dele] .w#calc>#sv,html[data-tab=empty] .w#calc>#p-empty,html[data-tab=connect] .w#calc>#p-connect{flex:0 0 auto;margin-top:0;height:var(--calc-h,499px);max-height:var(--calc-h,499px)}
  html[data-tab=dele] .w#calc>#p-dele>.pw{padding-bottom:0}
}
/* the copy glyph as a real button in the address row: a bordered square, lit on hover */

/* reverted: the button alone at the head's right, the address chip on its own line */

/* ── the head: the name at the titles' size, the address chip at the row's right; the
   DISCONNECT button runs the full width along the wallet pane's floor ── */
#wk-mine .wk-bh{min-height:32px;height:32px;max-height:32px}
#wk-mine .wk-bh h3{font-size:13px;letter-spacing:-.01em;padding-left:11px}
#wk-mine .wk-bh h3::before{height:12px}
#wk-mine .wk-bh .wk-addrw{margin-left:auto;height:24px;display:inline-flex;align-items:center;gap:0;padding:0 4px 0 8px;border-radius:5px;border:1px solid var(--wbd2);background:linear-gradient(180deg,#17172f,#0e0e1d);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 1px 2px rgba(0,0,0,.4);min-width:0;max-width:100%;align-self:center}
#wk-mine .wk-bh .wk-addr{font-family:var(--wmono);font-size:9.5px;letter-spacing:.03em;color:var(--ws);line-height:1;gap:1px;display:inline-flex;align-items:center;white-space:nowrap}
#wk-mine .wk-bh .wk-addr em{font-style:normal;color:#b9b0ff}
#wk-mine .wk-bh .wk-addr::before{display:none}

/* a radius on a one-sided border drew an arc behind the mark */

#wk-mine .wk-tbl2{min-height:calc(16px + 6 * 30px)}
@media(max-width:700px){#wk-mine .wk-bh .wk-addrw{max-width:60%}}
/* the gain tag follows the name, not the cell's far edge; the unit rides with it */
#dpicks td.nm .nmw>span{flex:0 1 auto}
#prolist .wk-tbl2 td.nm .nmw>span{flex:0 1 auto}

#dpicks td.nm .gtag i{font-style:normal;color:var(--wf);margin-left:1px;letter-spacing:0}
#prolist .wk-tbl2 td.nm .gtag i{font-style:normal;color:var(--wf);margin-left:1px;letter-spacing:0}
#dpicks td.nm .gtag.dim i{color:var(--wf)}
#prolist .wk-tbl2 td.nm .gtag.dim i{color:var(--wf)}
/* the tiles: the whole figure at a quieter size */

/* the tiles: the wallet's two tokens on the first row, the three staking figures beneath */
#wk-mine .wk-bal5{grid-template-columns:repeat(6,minmax(0,1fr))}
#wk-mine .wk-b5:nth-child(1){grid-column:1/4}#wk-mine .wk-b5:nth-child(2){grid-column:4/7}
#wk-mine .wk-b5:nth-child(3),#wk-mine .wk-b5:nth-child(4),#wk-mine .wk-b5:nth-child(5){grid-column:span 2}
/* refresh and the clock at the title row's far right, the cooldown note before them */

#wk-plan>.wk-ph .wk-ago{order:2;margin-left:auto}
#wk-plan>.wk-ph:has(.wk-lockn:not([hidden])) .wk-ago{display:inline;}
#wk-plan>.wk-ph .wk-ib{order:3;margin-left:8px}
@media(max-width:700px){#wk-plan>.wk-ph:has(.wk-lockn:not([hidden])) .wk-ago{display:none}}
/* a row that would pay less is not greyed: it reads like every other row, and only its
   "there" rate turns red to say so */
#dpicks tbody tr.lt td,#dpicks tbody tr.lt td.nm .nmw>span,#dpicks tbody tr.lt.on td{color:inherit}
#prolist .wk-tbl2 tbody tr.lt td,#prolist .wk-tbl2 tbody tr.lt td.nm .nmw>span,#prolist .wk-tbl2 tbody tr.lt.on td{color:inherit}
#dpicks tbody tr.lt td{color:var(--ws)}
#prolist .wk-tbl2 tbody tr.lt td{color:var(--ws)}
#dpicks tbody tr.lt td.nm .nmw>span{color:#fff8dc}
#prolist .wk-tbl2 tbody tr.lt td.nm .nmw>span{color:#fff8dc}
#dpicks tbody tr.lt td.ok{color:var(--wgreen)}
#prolist .wk-tbl2 tbody tr.lt td.ok{color:var(--wgreen)}#dpicks tbody tr.lt td.warn{color:var(--wamber)}
#prolist .wk-tbl2 tbody tr.lt td.warn{color:var(--wamber)}#dpicks tbody tr.lt td.bad{color:var(--wburn)}
#prolist .wk-tbl2 tbody tr.lt td.bad{color:var(--wburn)}
#dpicks tbody tr.lt td.r2 b{color:var(--wburn)}
#prolist .wk-tbl2 tbody tr.lt td.r2 b{color:var(--wburn)}
/* the line at the left of the Outcome head, after the count; the button keeps the right */

#wk-mv .wk-mvh .wk-btn.wk-go{margin-left:auto}
/* the gain tag keeps a clear distance from the name */

/* ── the actions, unmistakable: the field carries a lit STAKE label, a brighter frame and
   a readable placeholder; Redelegate is tall, bold and lit; the doors a size up ── */

#wk-plan input.wk-amt2::placeholder{opacity:.9}

#wk-mv .wk-mvh .wk-btn.wk-go{height:34px;min-width:150px;padding:0 20px;font-size:10.5px;letter-spacing:.2em;font-weight:700;border-radius:7px;color:#03120a;
background:linear-gradient(180deg,#46f585,#22c65e);border:1px solid #3cf07a;box-shadow:0 0 0 1px rgba(46,224,106,.25),0 12px 28px -12px rgba(46,224,106,.9),inset 0 1px 0 rgba(255,255,255,.35)}
#wk-mv .wk-mvh .wk-btn.wk-go:hover{filter:brightness(1.06);transform:translateY(-1px);box-shadow:0 0 0 1px rgba(46,224,106,.35),0 16px 32px -12px rgba(46,224,106,1),inset 0 1px 0 rgba(255,255,255,.35)}
#wk-mv .wk-mvh .wk-btn.wk-go:disabled{background:linear-gradient(180deg,#232345,#191933);border-color:#3a3a62;color:#8a88b0;box-shadow:inset 0 1px 0 #ffffff08;font-weight:600}
#wk-mv .wk-mvh{height:auto;min-height:40px;max-height:none}
#wk-mine .wk-t1 .wk-unb{line-height:1;align-self:center;}   /* the doors sit on the title's line, no taller than it */

@media(max-width:700px){#wk-mv .wk-mvh .wk-btn.wk-go{min-width:120px}}
/* the list at half the frame: the two lifetime columns step aside until the frame is wide */
/* the count, large */

/* in a narrow name cell the name keeps at least this much; the tag gives way instead */
#dpicks td.nm .nmw>span{min-width:64px}
#prolist .wk-tbl2 td.nm .nmw>span{min-width:64px}
#dpicks td.nm .gtag{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:12px}
#prolist .wk-tbl2 td.nm .gtag{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:12px}
/* ── the stake field, made anew: a wide framed block with its own label, a large figure
   and MAX inside; Redelegate a full-width bar pinned to the Outcome pane's floor ── */

#wk-plan input.wk-amt2{font-size:18px;letter-spacing:-.02em;padding:0 12px;color:#fff8dc}
#wk-plan input.wk-amt2::placeholder{font-size:10px;letter-spacing:.2em;color:var(--ws)}
#wk-plan .wk-field .wk-max{height:30px;padding:0 12px;border-radius:6px;font-size:8.5px;letter-spacing:.16em;border-color:rgba(185,176,255,.4);background:rgba(185,176,255,.1);color:#d6d1ff}
#wk-plan .wk-field .wk-max b{font-size:11px;color:#fff8dc}
#wk-plan .wk-field .wk-max:hover{background:rgba(185,176,255,.2);border-color:#b9b0ff}
#wk-plan .wk-field.need{border-color:#ffb02e;box-shadow:0 0 0 3px rgba(255,176,46,.16),0 0 18px -4px rgba(255,176,46,.7),inset 0 1px 0 #ffffff0a}

#wk-mv .wk-btn.wk-go{margin:8px 0 0;width:100%;height:40px;flex:0 0 auto;font-family:var(--wmono);font-size:11px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;border-radius:8px;color:#03120a;display:inline-flex;align-items:center;justify-content:center;
background:linear-gradient(180deg,#46f585,#22c65e);border:1px solid #3cf07a;box-shadow:0 0 0 1px rgba(46,224,106,.25),0 14px 30px -12px rgba(46,224,106,.9),inset 0 1px 0 rgba(255,255,255,.35);transition:filter .15s,transform .12s,box-shadow .15s;cursor:pointer}
#wk-mv .wk-btn.wk-go:hover{filter:brightness(1.06);transform:translateY(-1px)}
#wk-mv .wk-btn.wk-go:active{transform:translateY(0) scale(.99)}
#wk-mv .wk-btn.wk-go:disabled{background:linear-gradient(180deg,#232345,#191933);border-color:#3a3a62;color:#8a88b0;box-shadow:inset 0 1px 0 #ffffff08;font-weight:600;transform:none;filter:none;cursor:default;opacity:1}

#wk-mv .wk-moves{flex:1 1 auto}
#wk-mv .wk-mvempty{flex:1 1 auto}
#wk-mv{padding-bottom:12px}
#wk-mv::after{display:none}

/* the field shares the first line with the count; the initial-letter mark keeps its circle */

#dpicks td.nm .nmw>span.wk-lgx{min-width:0;flex:0 0 17px;width:17px}
#prolist .wk-tbl2 td.nm .nmw>span.wk-lgx{min-width:0;flex:0 0 17px;width:17px}

/* ── the three dial cards (eta, C, S), 2026-09-27 (kp-): a real title and one plain line, the figure the
   card is about, facts with labels one can read, sentences where the old card had code ── */
.kp{--kp-f:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-family:var(--kp-f)}
.kp .kp-h{display:flex;align-items:center;gap:13px;padding:18px 22px 15px;border-bottom:1px solid var(--edge)}
.kp .kp-h .disc{position:static;transform:none;width:34px;height:34px;flex:0 0 34px;font-size:14px;margin:0}
.kp .kp-h .disc .kg{width:62%;height:62%}
.kp .kp-h h2{margin:0;font-size:18px;font-weight:700;letter-spacing:-.01em;line-height:1.2;color:var(--ink)}
.kp .kp-h p{margin:3px 0 0;font-size:12.5px;line-height:1.45;color:var(--ink2);text-wrap:pretty}
.kp .backq{flex:0 0 auto;align-self:center}
.kp .kp-b{display:flex;flex-direction:column;gap:12px;padding:16px 22px 20px}
.kp em{font-style:normal;font-size:11.5px;line-height:1.3;color:var(--ink2)}
.kp small{font-size:11.5px;line-height:1.3;color:var(--ink2)}
.kp b{font-weight:700;color:var(--ink)}
.kp .am{color:#ffb02e}.kp .gr{color:#2ee06a}.kp .or{color:#ff7a57}
/* the lead figure(s) */
.kp-hero,.kp-eq{display:flex;align-items:stretch;gap:10px;padding:14px 16px;border:1px solid var(--edge2);border-radius:12px;background:rgba(255,255,255,.03)}
.kp-hv{flex:1 1 0;display:flex;flex-direction:column;gap:3px;min-width:0}
.kp-hv b{font-size:30px;line-height:1.1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.kp-hero .kp-arr,.kp-eq>i{font-style:normal;align-self:center;font-size:20px;color:var(--ink3)}
.kp-eq .kp-hv b{font-size:21px}.kp-eq .kp-res b{font-size:27px}
.kp-eq .kp-res{padding-left:12px;border-left:1px solid var(--edge2)}
/* facts */
.kp-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.kp-g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.kp-f{display:flex;flex-direction:column;gap:3px;padding:10px 13px 11px;border:1px solid var(--edge);border-radius:10px;background:rgba(255,255,255,.02);min-width:0;text-align:left}
.kp-f b{font-size:19px;line-height:1.15;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kp-wide{grid-column:1/-1}
.kp-btn{font:inherit;color:inherit;cursor:pointer}
.kp-btn:hover{border-color:#ffb02e}.kp-btn:focus-visible{outline:2px solid #ffb02e;outline-offset:2px}
.kp-go{margin-left:8px;font-size:12px;font-weight:600;color:#ffb02e}
/* eta's rule: the live half lit, the pair opens the concentration card */
.kp-rule{display:grid;grid-template-columns:1fr 1fr auto;align-items:center;gap:8px;padding:8px;border:1px solid var(--edge2);border-radius:12px;cursor:pointer;background:rgba(255,255,255,.02)}
.kp-rule:hover{border-color:#ff7a57}.kp-rule:focus-visible{outline:2px solid #ff7a57;outline-offset:2px}
.kp-ru{display:flex;flex-direction:column;gap:2px;padding:8px 11px;border-radius:9px;border:1px solid transparent}
.kp-ru b{font-size:17px;font-variant-numeric:tabular-nums;color:var(--ink2)}
.kp-ru.hot{border-color:color-mix(in srgb,#ffb02e 55%,transparent);background:color-mix(in srgb,#ffb02e 10%,transparent)}
.kp-ru.hot b{color:#ffb02e}
.kp-ru.hot em::after{content:"  now";color:#ffb02e;font-weight:600}
.kp-rgo{padding:0 8px;font-size:12px;font-weight:600;color:#ff7a57;white-space:nowrap}
/* notes and the move sentence */
.kp .kp-notes{margin:0;padding:0 0 0 2px;list-style:none;display:flex;flex-direction:column;gap:6px}
.kp .kp-notes li{position:relative;padding-left:14px;font-size:13px;line-height:1.5;color:var(--ink2)}
.kp .kp-notes li::before{content:"";position:absolute;left:0;top:.62em;width:5px;height:5px;border-radius:50%;background:#ffb02e}
.kp .kp-notes b{color:var(--ink)}
.kp-move{margin:0;padding:12px 14px;border-radius:10px;border:1px solid color-mix(in srgb,#ff7a57 40%,transparent);background:color-mix(in srgb,#ff7a57 7%,transparent);font-size:13px;line-height:1.55;color:var(--ink2)}
.kp-lw{text-transform:lowercase}
.kp .haltn{display:inline-block;min-width:1.6em;padding:0 6px;border:1.5px solid #ff4d1f;border-radius:6px;color:#ff7a57;text-align:center}
/* staked: the figure over a bar of the bonded share */
.kp-big{display:flex;flex-direction:column;gap:6px;padding:14px 16px;border:1px solid var(--edge2);border-radius:12px;background:rgba(255,255,255,.03)}
.kp-big b{font-size:32px;line-height:1.05;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.kp-big em{font-size:12.5px}.kp-big strong{color:var(--ink);font-weight:700}
.kp-bar{display:block;height:8px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden}
.kp-bar i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#ffb02e,#8fe8e0)}
@media(max-width:560px){.kp .kp-h{padding:14px 16px 12px}.kp .kp-b{padding:14px 16px 16px}.kp-hv b{font-size:24px}.kp-eq{flex-wrap:wrap}
.kp-eq .kp-res{flex-basis:100%;padding:10px 0 0;border-left:0;border-top:1px solid var(--edge2)}.kp-g3{grid-template-columns:1fr 1fr}.kp-rule{grid-template-columns:1fr 1fr}.kp-rgo{grid-column:1/-1;text-align:right}}

/* ── Self, 2026-09-27: no balance boxes; the three lists hold ten rows and scroll past them; the columns
   sit at the bottom of the frame and the room above carries one Autopilot row (sa-) ── */
/* its own colours: Self's pane does not carry the dashboard screens' tokens (the hand layer sets the day ones) */
.sa-band{--sa-v:#b9b0ff;--sa-t:#2bc8bd;--sa-g:#2ee06a;--sa-on:#161038;display:flex;align-items:center;justify-content:center;flex:0 0 auto;padding:0 0 10px}
.sa-row{display:flex;align-items:center;gap:18px;width:100%;max-width:1200px;height:52px;padding:0 10px 0 18px;border-radius:999px;white-space:nowrap;
border:1px solid color-mix(in srgb,var(--sa-v) 40%,transparent);background:linear-gradient(90deg,color-mix(in srgb,var(--sa-v) 14%,transparent),color-mix(in srgb,var(--sa-t) 8%,transparent))}
.sa-k{font-family:var(--wmono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--sa-v)}
.sa-main{font-size:16px;color:var(--ws)}.sa-main b{color:var(--wt);font-weight:700}
.sa-main .sa-num{color:var(--sa-g);font-variant-numeric:tabular-nums;font-size:19px;font-weight:800}
.sa-rot{position:relative;flex:1 1 auto;height:22px;min-width:0;padding-left:18px;border-left:1px solid color-mix(in srgb,var(--sa-v) 35%,transparent)}
.sa-l{position:absolute;left:18px;right:0;top:0;font-size:13.5px;line-height:22px;color:var(--ws);opacity:0;transform:translateY(6px);overflow:hidden;text-overflow:ellipsis}
.sa-l.on{opacity:1;transform:none}
@media(prefers-reduced-motion:no-preference){.sa-l{transition:opacity .45s,transform .45s}}
.sa-go{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 16px;border-radius:999px;background:var(--sa-v);color:var(--sa-on);font-weight:700;font-size:13.5px;text-decoration:none;flex:0 0 auto}
.sa-go svg{display:block;flex:0 0 16px;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
@media(prefers-reduced-motion:no-preference){.sa-go svg{transition:transform .18s}.sa-go:hover svg{transform:translateX(3px)}}
.sa-go:focus-visible{outline:2px solid var(--sa-v);outline-offset:3px}
@media(max-width:1100px){.sa-rot{display:none}.sa-row{justify-content:space-between}}
@media(max-width:700px){.sa-row{height:auto;min-height:48px;padding:8px 8px 8px 14px;gap:10px;white-space:normal;border-radius:14px}.sa-k{display:none}.sa-main{font-size:14px}}
/* ten rows at the most (measured: a 29-30 px head, 32 px a row), fewer leave the room; each list scrolls
   past them. The selectors match the earlier no-wallet rule that lifts the cap, so this one wins */
#wk-mine .wk-tbl2,html:not([data-wallet]) #wk-mine .wk-tbl2{max-height:calc(29px + 10 * 32px)}
#wk-plan .wk-tbl2,html:not([data-wallet]) #wk-plan .wk-tbl2{max-height:calc(30px + 10 * 32px)}
#dstrat{max-height:calc(10 * 32px);overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
/* Outcome never sets the row's height: the two lists do. contain:size sizes it as if empty, it stretches to
   the row, and its moves scroll inside it, so a long plan cannot grow the row and lift all three columns */
@media(min-width:901px){#wk-mv{contain:size;min-height:0}#wk-mv #dstrat{flex:1 1 0;min-height:0;max-height:none}}
/* Manage stands as the Overview does (2026-09-27): the same framed box, the wallet strip on top, and the
   three sections taking all the height left - their lists scroll inside them. The first column is the
   wallet box's width above it (1.6 of the strip's 6.6 parts), Redelegate and Outcome share the rest */
@media(min-width:901px){
  #p-dele #wbody{display:flex;flex-direction:column;justify-content:flex-start;gap:12px;padding:10px 14px;box-sizing:border-box;
    border:1px solid #232342;border-radius:8px;background:linear-gradient(180deg,#0d0d1c,#09090f)}
  #p-dele #sd-mstrip{flex:0 0 auto}
  #p-dele #wbody>.wk-two{position:relative;inset:auto;flex:1 1 auto;min-height:0;height:auto;
    grid-template-columns:max(calc((100% - 2px) * 0.242424 + 2px),280px) minmax(0,1.9fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr);align-items:stretch;align-content:stretch;gap:12px}
  #p-dele #wk-mine,#p-dele #wk-plan{min-height:0}
  #p-dele #wk-mine .wk-tbl2,#p-dele #wk-plan .wk-tbl2{flex:1 1 auto;height:auto;min-height:0;max-height:none}
  /* the narrower Delegations column: its figures take less room, so the names keep theirs */
  #p-dele #dmy col:nth-child(2){width:28px!important}#p-dele #dmy col:nth-child(4){width:60px!important}
  #p-dele #dmy col:nth-child(5){width:52px!important}#p-dele #dmy col:nth-child(6){width:50px!important}
}
/* the three title rows one height (the Redelegate row's, which holds the amount field), everything in
   them centred: Delegations, Redelegate and Outcome, and Stake / Unstake / Rewards, on one line */
@media(min-width:901px){#wk-mine .wk-t1,#wk-plan .wk-t2,#wk-mv .wk-t3,#wk-mv #dmvh{height:32px;min-height:32px;max-height:32px;padding-top:0;padding-bottom:0;margin-top:0;margin-bottom:0;align-items:center;box-sizing:border-box}}
/* with no moves yet the table keeps its head (from, to, stake, ATONE/yr) and the prompt sits under it */
#wk-mv #dstrat.none{flex:0 0 auto}
@media(min-width:901px){
  /* the columns stand on the frame's floor at their own height; the band takes the room above them */
  #wbody{display:flex;flex-direction:column;justify-content:flex-end}
  .sa-band{flex:1 1 auto;min-height:62px}
  .wk-two{position:relative;left:auto;right:auto;top:auto;bottom:auto;flex:0 1 auto;min-height:0;grid-template-rows:minmax(0,1fr)}
  #wk-mine .wk-tbl2{flex:0 1 auto;height:auto;min-height:0}
  #wk-plan .wk-tbl2,html:not([data-wallet]) #wk-plan .wk-tbl2{flex:0 1 auto;min-height:0}
}

/* ── three columns again, in the calculator's frame: the wallet down the left,
   Redelegate in the middle taking what is left, Outcome on the right ── */
@media(min-width:901px){
  .wk-two{grid-template-columns:clamp(300px,26%,360px) minmax(0,1fr) clamp(290px,25%,350px);grid-template-rows:minmax(0,1fr)}
  #wk-mine{grid-column:1;grid-row:1}
  #wk-plan{grid-column:2;grid-row:1}
  #wk-mv{grid-column:3;grid-row:1}
  /* the Outcome head is narrow again: the tagline keeps to the title's line as a
     two-line chip on the right - "Earn more APR." over "Decentralize the chain." */
  #wk-mv .wk-mvh{flex-wrap:nowrap;height:auto;min-height:40px}
  
  /* the outcome boxes, legible: taller, the labels a real size, the figures larger */
  #wk-mv .wk-ans{margin:6px 0 0}
  #wk-mv .wk-ans .p,#wk-mv .wk-ans .p.rate,#wk-mv .wk-ans .p.gain,#wk-mv .wk-ans .p.lock{height:56px;gap:7px;padding:0 6px}
  #wk-mv .wk-ans .p i{font-size:8.5px;letter-spacing:.12em;color:var(--ws)}
  #wk-mv .wk-ans .p b{font-size:14px}
  #wk-mv .wk-ans .p.rate b{font-size:12.5px}
  #wk-mv .wk-ans .p .arr{font-size:12px}
  #wk-mv .wk-ans .p.rate{flex:1.7 1 0;row-gap:7px;column-gap:4px}
  #p-dele #wk-mv .wk-ans .p.lock svg{width:11px;height:11px;margin:0 3px 0 0}
  /* the amount field alone on its line: a set width on the left, not the whole line */

#wk-plan input.wk-amt2{font-size:16px;padding:0 10px}
  #wk-plan .wk-field .wk-max{height:26px;padding:0 10px;font-size:8px}
  #wk-plan .wk-field .wk-max b{font-size:10.5px}
}
/* below a wide frame the side columns are tighter: the counts leave the Delegations and
   Outcome lines so the doors and the tagline keep to them (the wallet list drops its
   share column too) */
/* desktop: the title row holds Stake, Unstake and Claim, so the count gives way (the rows below say it) */
@media(min-width:901px){
  #wk-mine .wk-t1 .wk-pn{display:none}
}
/* a move that earns less: its ATONE/year in red - the box, the row tag, the moves list - at every width */
/* a move that earns less: its ATONE/year in red, in the box, the row tag and the moves list */
#wk-mv .wk-ans .p.gain b.neg{color:var(--wburn)}
#wk-mv .wk-ans .p.rate b.aft.neg{color:var(--wburn)}
.txans .p.aft.neg b,.txans .p.gain.neg b{color:var(--wburn)}
#wk-mv .wk-ans .p.gain:has(b.neg){--c:#ff4d1f}
#dpicks td.nm .gtag.neg{color:var(--wburn);border-color:rgba(255,77,31,.35);background:rgba(255,77,31,.07)}
#prolist .wk-tbl2 td.nm .gtag.neg{color:var(--wburn);border-color:rgba(255,77,31,.35);background:rgba(255,77,31,.07)}
#dpicks td.nm .gtag.neg i{color:var(--wburn);opacity:.7}
#prolist .wk-tbl2 td.nm .gtag.neg i{color:var(--wburn);opacity:.7}
#wk-mv .wk-moves td.gn.neg{color:var(--wburn)}
/* ── the amount as a chip in the Redelegate title row, the address chip's size, right
   after the word: the figure and MAX inside 24px ── */
#wk-plan>.wk-ph .wk-field{order:0;flex:0 0 auto;width:200px;min-width:0;height:24px;margin:0 0 0 14px;padding:0 3px 0 0;border-radius:5px;border:1px solid var(--wbd2);
background:linear-gradient(180deg,#17172f,#0e0e1d);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 1px 2px rgba(0,0,0,.4);align-self:center;display:inline-flex;align-items:center}
#wk-plan>.wk-ph .wk-field:hover{border-color:var(--ws)}
#wk-plan>.wk-ph .wk-field:focus-within{border-color:#b9b0ff;box-shadow:0 0 0 2px rgba(185,176,255,.16),inset 0 1px 0 rgba(255,255,255,.06)}
#wk-plan>.wk-ph input.wk-amt2{flex:1 1 auto;min-width:0;height:100%;width:auto;margin:0;border:0;background:transparent;font-size:11.5px;letter-spacing:0;padding:0 8px;color:#fff8dc;border-radius:5px 0 0 5px}
#wk-plan>.wk-ph input.wk-amt2::placeholder{font-size:8px;letter-spacing:.16em;color:var(--wf)}
#wk-plan>.wk-ph .wk-field .wk-max{height:18px;padding:0 7px;font-size:7px;letter-spacing:.12em;border-radius:4px;border-color:rgba(185,176,255,.4);background:rgba(185,176,255,.1);color:#d6d1ff}
#wk-plan>.wk-ph .wk-field .wk-max b{font-size:9.5px;color:#fff8dc}
#wk-plan>.wk-ph .wk-field.need{border-color:#ffb02e;box-shadow:0 0 0 2px rgba(255,176,46,.18),inset 0 1px 0 rgba(255,255,255,.06)}
#wk-plan>.wk-ph .wk-pre{display:none}
#dpicks{margin-top:10px}
#prolist .wk-tbl2{margin-top:10px}
/* the title row must also hold the cooldown note, the clock and the refresh: below a wide
   frame the note says "locked until" and the clock steps off while the note is up */
#wk-plan>.wk-ph .wk-lockn .w2{display:none}
/* the note sits right after the field, on the field's side; the clock and the refresh keep
   the far right whether the note is up or not */
#wk-plan>.wk-ph .wk-lockn{order:0;margin-left:10px}
#wk-plan>.wk-ph:has(.wk-lockn:not([hidden])) .wk-ago{margin-left:auto}

@media(min-width:701px) and (max-width:1559px){
  #wk-plan>.wk-ph .wk-field{width:180px}
  #wk-plan>.wk-ph .wk-lockn .w{display:none}
  #wk-plan>.wk-ph .wk-lockn .w2{display:inline}
}
@media(min-width:701px) and (max-width:1439px){
  #wk-plan>.wk-ph:has(.wk-lockn:not([hidden])) .wk-ago{display:none}
}
@media(max-width:700px){#wk-plan>.wk-ph{flex-wrap:wrap;row-gap:6px;height:auto;max-height:none;min-height:32px}#wk-plan>.wk-ph .wk-field{order:5;flex:1 1 100%;width:auto;margin:0}}
/* ── Disconnect as a filled bar, the wallet's amber, the mirror of the green Redelegate bar ── */

/* the stake column is the validator's own figure; what the plan adds is a tag at the right
   end of the name cell, against that column - its left edge moves with its size, nothing else does */
#dpicks td.stk{white-space:nowrap;font-variant-numeric:tabular-nums;color:#fff8dc}
#prolist .wk-tbl2 td.stk{white-space:nowrap;font-variant-numeric:tabular-nums;color:#fff8dc}
#dpicks td.nm .gtag.add{margin-left:auto;flex:0 0 auto;overflow:visible;padding:0;border:0;background:transparent;color:var(--wgreen);font-size:10.5px;letter-spacing:.02em}
#prolist .wk-tbl2 td.nm .gtag.add{margin-left:auto;flex:0 0 auto;overflow:visible;padding:0;border:0;background:transparent;color:var(--wgreen);font-size:10.5px;letter-spacing:.02em}
#dpicks td.nm .nmw:has(.gtag.add)>span:not(.wk-lgx){flex:0 1 auto;margin-right:10px}
#prolist .wk-tbl2 td.nm .nmw:has(.gtag.add)>span:not(.wk-lgx){flex:0 1 auto;margin-right:10px}
/* a validator's name in the Redelegate list is a door to its card, like a delegation row */
#dpicks td.nm[data-v]{cursor:pointer}
#prolist .wk-tbl2 td.nm[data-v]{cursor:pointer}
#dpicks td.nm[data-v]:hover .nmw>span:not(.wk-lgx){color:#fff;text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--wf)}
#prolist .wk-tbl2 td.nm[data-v]:hover .nmw>span:not(.wk-lgx){color:#fff;text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--wf)}
#dpicks td.nm[data-v]:focus-visible{outline:2px solid var(--wgreen);outline-offset:-2px;border-radius:4px}
#prolist .wk-tbl2 td.nm[data-v]:focus-visible{outline:2px solid var(--wgreen);outline-offset:-2px;border-radius:4px}
/* the count beside a title: its baseline on the title's, not its box centred on the box */
#wk-mine .wk-t1 .wk-pn,#wk-mv .wk-t3 .wk-pn{position:relative;top:1px;line-height:1}
/* the two doors read as buttons: filled, lifted on hover, pressed on tap */
#wk-mine .wk-t1 .wk-unb{cursor:pointer;border-radius:5px;height:22px;padding:0 11px;font-family:var(--wsans);font-size:11px;font-weight:600;letter-spacing:.01em;text-transform:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.08);transition:filter .12s,transform .12s,box-shadow .12s}
#wk-mine .wk-t1 .wk-unb.wk-stb{color:#5cf08f;border-color:rgba(46,224,106,.55);background:linear-gradient(180deg,rgba(46,224,106,.2),rgba(46,224,106,.1))}
#wk-mine .wk-t1 .wk-unb:not(.wk-stb){color:#ffc453;border-color:rgba(255,176,46,.55);background:linear-gradient(180deg,rgba(255,176,46,.2),rgba(255,176,46,.1))}
#wk-mine .wk-t1 .wk-unb:hover{transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 6px 14px -8px rgba(0,0,0,.9)}
#wk-mine .wk-t1 .wk-unb.wk-stb:hover{color:#8ef0c8;border-color:#3cf07a;background:linear-gradient(180deg,rgba(46,224,106,.3),rgba(46,224,106,.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 6px 14px -6px rgba(46,224,106,.5)}
#wk-mine .wk-t1 .wk-unb:not(.wk-stb):hover{color:#ffd58a;border-color:#ffc453;background:linear-gradient(180deg,rgba(255,176,46,.3),rgba(255,176,46,.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 6px 14px -6px rgba(255,176,46,.5)}
#wk-mine .wk-t1 .wk-unb:active{transform:translateY(0) scale(.97);filter:brightness(.98)}
#wk-mine .wk-t1 .wk-unb:focus-visible{outline:2px solid #fff;outline-offset:2px}
/* the three doors - Stake, Unstake, Rewards - sit together at the right end of the title row */
#wk-mine .wk-t1{column-gap:5px}
#wk-mine .wk-t1 .wk-unb.wk-stb{margin-left:auto}   /* Stake, Unstake, Reward at the right end of the title row */
#wk-mine .wk-t1 .wk-unb+.wk-unb{margin-left:0}
#wk-mine .wk-t1 .wk-unb{padding:0 8px;font-size:10.5px}
@media(min-width:901px) and (max-width:1399px){#wk-mine .wk-t1 .wk-unb{padding:0 7px;font-size:10px}}
@media(min-width:901px) and (max-width:1279px){#wk-mine .wk-t1 .wk-unb{padding:0 4px}}
#wk-mine .wk-t1 .wk-unb.wk-clb{color:#6fe3da;border-color:rgba(43,200,189,.55);background:linear-gradient(180deg,rgba(43,200,189,.2),rgba(43,200,189,.1))}
#wk-mine .wk-t1 .wk-unb.wk-clb:hover{color:#a6f1eb;border-color:#2bc8bd;background:linear-gradient(180deg,rgba(43,200,189,.3),rgba(43,200,189,.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 6px 14px -6px rgba(43,200,189,.5)}
/* the five tiles, tighter: less empty room, a label one can read, a mark one can see */
#wk-mine .wk-b5{height:46px;padding:0 6px;gap:3px;justify-content:center}
#wk-mine .wk-b5 i{font-size:9px;letter-spacing:.1em;color:#c1bfdc;gap:5px}
#wk-mine .wk-b5 i img{width:15px;height:15px}
#wk-mine .wk-b5 b{font-size:13.5px;letter-spacing:-.02em}
@media(max-width:700px){#wk-mine .wk-b5{height:44px}#wk-mine .wk-b5 b{font-size:12px}#wk-mine .wk-b5 i{font-size:8.5px}#wk-mine .wk-b5 i img{width:13px;height:13px}}
/* the delegations table: a breath under the title, a band of column names one can read,
   room between the columns */
#wk-mine .wk-tbl2{margin-top:10px}
#dmy thead th{font-size:8.5px;letter-spacing:.14em;color:#c1bfdc;padding:8px 6px 7px;background:linear-gradient(180deg,#151530,#0f0f22);border-top:1px solid var(--wbd2);border-bottom:1px solid var(--wbd2)}
#dmy thead th:first-child{border-left:1px solid var(--wbd2);border-radius:5px 0 0 5px;padding-left:6px}
#dmy thead th:last-child{border-right:1px solid var(--wbd2);border-radius:0 5px 5px 0}
#dmy thead th.l{padding-left:8px}
#dmy tbody td{padding:0 6px;height:32px;font-size:11.5px}
#dmy tbody td.rk{padding-left:6px}
#dmy tbody td.nm{padding-left:8px}
#dmy tbody tr:first-child td{border-top:0}
@media(max-width:700px){#dmy thead th{padding:7px 5px 6px}#dmy tbody td{padding:0 5px;height:30px}}

/* ── day or night: a switch at the bar's end; the choice is stamped on <html data-theme>
   by boot.js before the first paint (the reader's own, else the browser's preference) ── */
.thbtn{margin-left:auto;width:36px;height:36px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--edge2);background:transparent;color:var(--ink2);cursor:pointer;transition:color .15s,border-color .15s,background .15s;align-self:center}
.thbtn:hover{color:var(--ink);border-color:var(--ink3)}
.thbtn:focus-visible{outline:2px solid var(--acc,var(--hot));outline-offset:2px}
.thbtn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin:0;display:block}
.thbtn .moon{display:none}
html[data-theme=light] .thbtn .sun{display:none}
html[data-theme=light] .thbtn .moon{display:block}
@media(max-width:620px){.thbtn{width:32px;height:32px;margin-left:auto}}
/* ── the three words in the bar as boxes: a hairline box a little wider than the word, the open
   one in its own colour, Governance boxed too but dim while it is closed; the keyboard ring
   sits outside the box ── */

/* ── Autopilot's line in the wallet: its state at a glance, and the door to set it up,
   manage it or revoke it ── */
#wk-mine .wk-ap{display:flex;align-items:center;gap:10px;height:44px;margin:8px 0 0;padding:0 12px;border:1px solid rgba(185,176,255,.5);border-radius:8px;background:linear-gradient(180deg,#1b1735,#100e22);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 0 1px rgba(185,176,255,.12),0 10px 24px -14px rgba(185,176,255,.8);flex:0 0 auto;position:relative;overflow:hidden}
#wk-mine .wk-ap::before{content:"";position:absolute;left:12px;right:12px;top:0;height:1px;background:linear-gradient(90deg,transparent,#b9b0ff,transparent);opacity:.9}
#wk-mine .wk-ap[hidden]{display:none}
#wk-mine .wk-apk{font-family:var(--wsans);font-size:14px;font-weight:700;color:#d6d1ff;letter-spacing:-.01em;flex:0 0 auto;text-shadow:0 0 14px rgba(185,176,255,.45)}
#wk-mine .wk-aps{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--wmono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--wf)}
#wk-mine .wk-aps.on{color:var(--wgreen)}
#wk-mine .wk-apb{flex:0 0 auto;height:28px;padding:0 14px;border-radius:6px;border:1px solid #c9c2ff;background:linear-gradient(180deg,#cdc6ff,#9f95f2);color:#14103a;font-family:var(--wsans);font-size:12px;font-weight:700;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 8px 18px -10px rgba(185,176,255,.9);transition:filter .15s,transform .12s}
#wk-mine .wk-apb:hover{filter:brightness(1.06);transform:translateY(-1px)}
#wk-mine .wk-apb:active{transform:translateY(0) scale(.98)}
#wk-mine .wk-apb:focus-visible{outline:2px solid #b9b0ff;outline-offset:2px}
/* stake on a validator outside the active set: the row reads as such, its APR nil */
#dmy tbody tr.inactive td{color:var(--wf)}
#dmy tbody tr.inactive td.nm span{color:var(--wamber)}
#dmy tbody tr.inactive td.rw{color:var(--wf)}
/* ── transaction notifies: one small card at the top right, under the bar, above the
   Outcome column (the GATA app's toast, top-anchored). A spinner from the moment a
   signing starts until the chain itself confirms the transaction, then green for a
   block or red with the chain's reason; a cross closes it. Nothing else narrates a
   signing - the button spins, this card answers. ── */
.wk-notes{position:fixed;top:78px;right:28px;z-index:120;display:flex;flex-direction:column;gap:9px;align-items:flex-end;pointer-events:none;max-width:min(92vw,380px)}
.wk-note{pointer-events:auto;display:flex;align-items:center;gap:10px;padding:10px 12px 10px 13px;border-radius:12px;background:var(--wc,#0b0b16);color:var(--wt,#e6e4f0);
font-family:var(--wsans);font-size:12.5px;line-height:1.4;border:1px solid rgba(185,176,255,.4);border-left:3px solid #b9b0ff;
box-shadow:0 22px 50px -26px rgba(0,0,0,.95),0 0 26px -18px #b9b0ff;animation:notein .18s ease-out both}
.wk-note.ok{border-color:rgba(46,224,106,.4);border-left-color:var(--wgreen);box-shadow:0 22px 50px -26px rgba(0,0,0,.95),0 0 26px -18px var(--wgreen)}
.wk-note.err{border-color:rgba(255,77,31,.4);border-left-color:var(--wburn);box-shadow:0 22px 50px -26px rgba(0,0,0,.95),0 0 26px -18px var(--wburn)}
.wk-note .sp{width:14px;height:14px;flex:0 0 auto;border-radius:50%;border:2px solid rgba(185,176,255,.25);border-top-color:#b9b0ff;animation:notespin .8s linear infinite}
#p-dele~.wk-notes svg,.wk-note svg{width:15px;height:15px;flex:0 0 auto;fill:none;stroke:var(--wgreen);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;margin:0;max-height:none}
.wk-note.err svg{stroke:var(--wburn)}
.wk-note b{font-weight:600;letter-spacing:0;white-space:nowrap}
.wk-note i{font-style:normal;color:var(--ws);min-width:0;word-break:break-word}
.wk-note .x{flex:0 0 auto;margin-left:2px;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border:0;background:none;color:var(--wf);font-size:13px;line-height:1;cursor:pointer;padding:0}
.wk-note .x:hover{color:var(--wt)}
.wk-note .x:focus-visible{outline:2px solid #b9b0ff;outline-offset:2px;border-radius:4px}
@keyframes notein{from{opacity:0;transform:translateX(18px) scale(.98)}to{opacity:1;transform:none}}
@keyframes notespin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.wk-note{animation:none}.wk-note .sp{animation-duration:2.4s}}
@media(max-width:620px){.wk-notes{top:58px;right:10px;left:10px;align-items:stretch;max-width:none}}
/* a button that is signing spins in place; its word comes back with the answer */
.wk-btn.busy{pointer-events:none;position:relative;color:transparent!important;text-shadow:none!important}
.wk-btn.busy::after{content:"";position:absolute;left:calc(50% - 8px);top:calc(50% - 8px);width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;animation:notespin .8s linear infinite}
.txstep:empty{display:none}
/* the empty state sits in the middle of the list's room, not against its left edge */
#dmy .wk-empty{padding:0;height:100%;min-height:120px;display:flex;align-items:center;justify-content:center;text-align:center}
/* ── the phone reads the dashboard as a page, not a window: the panes stack at their own
   height and the PHONE scrolls - no inner scroll, no dead band under a capped frame ── */
@media(max-width:620px){
  /* the frame itself lets go: .below is the viewport-height window on every other tab,
     here it is simply the page (the bar stays sticky on its own) */
  html[data-tab=dele] .below{height:auto;min-height:100svh;overflow:visible}
  html[data-tab=dele] #p-dele,html[data-tab=dele] .w#calc>#p-dele,html[data-tab=dele] #sv,html[data-tab=dele] .w#calc>#sv,html[data-tab=empty] .w#calc>#p-empty,html[data-tab=connect] .w#calc>#p-connect{height:auto;max-height:none;margin-top:0;flex:1 1 auto;overflow:visible;overscroll-behavior:auto}
  html[data-tab=dele] .panes{overflow:visible;height:auto}
  html[data-tab=dele] .w#calc{overflow:visible}
  html[data-tab=dele] #p-dele>.pw,html[data-tab=dele] #sv>.sv-main{height:auto;min-height:0}
  html[data-tab=dele] .folder{position:sticky;top:0;z-index:20;background:var(--void)}
}
/* Staking on the phone reads as a page too (2026-09-27): Bonus, Trend and Picks were a window of Bonus's
   height with Trend and Picks scrolling inside it - a box that ended above the foot of the screen and
   left a dead band under it. Now the PHONE scrolls, as on the dashboard; the bar stays at the top */
@media(max-width:620px){
  html:is([data-tab=home],[data-tab=eta],[data-tab=pays]) .below{height:auto;min-height:100svh;overflow:visible}
  html:is([data-tab=home],[data-tab=eta],[data-tab=pays]) .panes{overflow:visible;height:auto}
  html:is([data-tab=home],[data-tab=eta],[data-tab=pays]) .w#calc{overflow:visible;height:auto}
  html[data-tab=home] .w#calc>#p-home,html[data-tab=eta] .w#calc>#p-eta,html[data-tab=pays] .w#calc>#p-pays,
  html[data-tab=home] #p-home,html[data-tab=eta] #p-eta,html[data-tab=pays] #p-pays{height:auto;max-height:none;margin-top:0;flex:1 1 auto;overflow:visible;overscroll-behavior:auto}
  html:is([data-tab=eta],[data-tab=pays]) :is(#p-eta,#p-pays)>.pw{height:auto;min-height:0}
  html:is([data-tab=home],[data-tab=eta],[data-tab=pays]) .folder{position:sticky;top:0;z-index:20;background:var(--void)}
}
/* ── the phone's Redelegate list: four real columns (its markup is its own), laid out
   fixed so nothing is cut; the APR pair shows whole; the plan's addition keeps room ── */
@media(max-width:700px){
  #dpicks table{table-layout:fixed}
#prolist .wk-tbl2 table{table-layout:fixed}
  #dpicks td.r2{white-space:nowrap;font-size:10px;padding-right:6px}
#prolist .wk-tbl2 td.r2{white-space:nowrap;font-size:10px;padding-right:6px}
  #dpicks td.r2 s{font-size:9.5px}
#prolist .wk-tbl2 td.r2 s{font-size:9.5px}
  #dpicks td.r2 em{font-size:9px;margin:0 1px}
#prolist .wk-tbl2 td.r2 em{font-size:9px;margin:0 1px}
  #dpicks td.r2 b{font-size:10.5px}
#prolist .wk-tbl2 td.r2 b{font-size:10.5px}
  #dpicks td.nm .nmw>span:not(.wk-lgx){min-width:0;flex:0 1 auto}
#prolist .wk-tbl2 td.nm .nmw>span:not(.wk-lgx){min-width:0;flex:0 1 auto}
  #dpicks td.nm .gtag.add{flex:0 0 auto;margin-left:6px}
#prolist .wk-tbl2 td.nm .gtag.add{flex:0 0 auto;margin-left:6px}
  #dpicks td.stk{padding:0 4px}
#prolist .wk-tbl2 td.stk{padding:0 4px}
  #dpicks td.ck{text-overflow:clip;padding:0 2px 0 4px}
#prolist .wk-tbl2 td.ck{text-overflow:clip;padding:0 2px 0 4px}
  /* the connect gate sits in the middle of its section; the squares with it */

}
/* the head line never wraps for want of a few px: the count is the one that yields */
#wk-mine .wk-t1{flex-wrap:nowrap}
#wk-mine .wk-t1 .wk-pn{min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* ── Simple: the same engine, one screen at a time ───────────────────────────
   A second header under the app's own - product nav, chain, address - and three
   screens: what the reader holds, what the keeper would do, what the set looks
   like. Every figure is read from the state the advanced dashboard already
   draws, so the two views can never disagree. Classes are sv-, scoped to #sv. */
/* The dashboard has two faces in ONE window: the simple screens are a sibling of
   the advanced pane inside .w#calc and carry the same frame rules, so switching
   between them moves nothing, and the calculator's grid is the dashboard's grid. */
#sv{display:none;min-width:0;overflow:hidden}
html[data-ui=simple][data-tab=dele] .w#calc>#p-dele{display:none}
/* the switch is the dashboard's; elsewhere it keeps its slot and says nothing */
/* the sub-header: the row the calculator gives its brandbar, on the dashboard.
   It carries who is connected in both views, and the screens in the simple one. */
/* three columns: the lockup, the screens centred, the wallet pinned right - so the
   wallet still sits at the end when the screens are not there (the advanced view) */
.sv-brand{display:flex;align-items:center;flex:1 1 0;min-width:0}
/* the lockup on one line: the mark, the name at title size on the mark's centre line, and the
   tagline beside it - the simple views' and the advanced view's own */
.sv-bw{display:flex;gap:10px;line-height:1;min-width:0}
/* the Dashboard's title per view (below) */
/* Stake (Easy and Pro): "Decentralize and earn more"; Autopilot: "Non-custodial staking"; Governance: its own */
.svtag.a{display:none}
html:is([data-sv="dashboard/overview"],[data-sv="dashboard/self"]) .svtag.a{display:inline-flex}
html:is([data-sv="dashboard/overview"],[data-sv="dashboard/self"]) .svtag.s{display:none}
/* Governance: 'Non-custodial Governance' in place of the second line */
html[data-sv="dashboard/governors"] .svtag.s{display:inline-flex}html[data-sv="dashboard/governors"] .svtag.a{display:none}
.sv-who{display:flex;align-items:center;gap:9px;flex:1 1 0;justify-content:flex-end;min-width:0}
/* connected: one pill the size of the Connect button - the wallet's mark, its address with a
   small copy glyph (one control), and a disconnect icon behind a hairline. No menu. */
.hdr-r #svconn,.wpill{width:178px;height:32px}
.hdr-r #svconn{justify-content:center}
.wpill{display:inline-flex;align-items:center;border:1px solid var(--wbd2);border-radius:10px;background:var(--wchip);overflow:hidden;flex:0 0 auto}
.wpl{width:16px;height:16px;margin:0 1px 0 9px;flex:0 0 auto}
.wpcopy{flex:1 1 auto;min-width:0;height:100%;display:inline-flex;align-items:center;gap:6px;padding:0 6px;border:0;background:transparent;
color:var(--wt);font-family:var(--wmono);font-size:10.5px;cursor:pointer}
.wpcopy .wpa{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wpcopy svg,.wpout svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}
.wpcopy svg{color:var(--wf)}.wpcopy svg.ok{display:none;color:var(--wgreen)}
.wpcopy.done svg.cp{display:none}.wpcopy.done svg.ok{display:block}
.wpcopy:hover{color:var(--wcyan)}.wpcopy:hover svg.cp{color:var(--wcyan)}
.wpout{flex:0 0 auto;width:34px;height:100%;display:grid;place-items:center;border:0;border-left:1px solid var(--wbd);background:transparent;color:var(--ws);cursor:pointer}
.wpout:hover{color:var(--wburn);background:rgba(255,77,31,.08)}
.wpcopy:focus-visible,.wpout:focus-visible{outline:2px solid var(--wcyan);outline-offset:-2px}
/* the dashboard's title greets the connected wallet by the name it gave itself */
.welc{margin-left:14px;padding-left:14px;border-left:1px solid var(--wbd2);font-size:13px;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.welc b{color:var(--wt);font-weight:700}
/* the title line is one 50px row and never wraps: as the window narrows, the greeting yields
   first (the wallet pill still says who is connected), then the tagline; the tabs keep it all */
/* the lockup owns the title line's first column, beside the centred views: the greeting
   only where there is room to read it, then each tagline while it still fits whole */
@media(min-width:621px) and (max-width:1599px){.brandbar .welc{display:none}}
@media(min-width:621px) and (max-width:1079px){.brandbar .svtag.a{display:none}}
@media(min-width:621px) and (max-width:1079px){.brandbar .svtag.s{display:none}}
.sv-who{position:relative}
.sv-menu{position:absolute;right:0;top:calc(100% + 9px);z-index:60;min-width:232px;padding:7px;border:1px solid var(--wbd2);
border-radius:12px;background:var(--wsolid);box-shadow:0 30px 70px -30px #000;display:flex;flex-direction:column;gap:4px}
.sv-menu .mh{padding:7px 9px 5px;font-family:var(--wmono);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--wf)}
.sv-menu .mi{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border:1px solid transparent;border-radius:9px;
background:transparent;color:var(--wt);font-family:var(--wsans);font-size:13px;text-align:left;cursor:pointer;min-width:0}
.sv-menu .mi:hover:not(:disabled){border-color:var(--wbd2);background:var(--wh)}
.sv-menu .mi:disabled{color:var(--wf);cursor:default}
.sv-menu .mi img{width:18px;height:18px;flex:0 0 auto}
.sv-menu .mi i{font-style:normal;margin-left:auto;font-family:var(--wmono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--wf)}
.sv-menu .mi.out{color:var(--wburn)}

/* the wallet pane keeps its structure but not its door: connect and disconnect
   are the sub-header's now, and the pane shows the shape of what will fill it */

html:not([data-wallet]) #wk-mine .wk-addrw{display:none}
/* the address IS the copy control now: one chip, the glyph riding with the figure */
#wk-mine .wk-bh .wk-addr{border:0;background:transparent;padding:0;margin:0;cursor:pointer;min-width:0}
#wk-mine .wk-bh .wk-addr:hover{color:#fff8dc}
#p-dele #wk-mine .wk-bh .wk-addr svg{width:11px;height:11px;margin:0 0 0 7px;flex:0 0 auto;max-height:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:.65}
#p-dele #wk-mine .wk-bh .wk-addr svg.ok{display:none;stroke-width:2.6}
#wk-mine .wk-bh .wk-addr.done{color:var(--wgreen)}
#p-dele #wk-mine .wk-bh .wk-addr.done svg{opacity:1}
#p-dele #wk-mine .wk-bh .wk-addr.done svg.cp{display:none}
#p-dele #wk-mine .wk-bh .wk-addr.done svg.ok{display:block}
.wk-tbl2 tr.skel td{opacity:.55}
.wk-tbl2 tr.skel td b{display:block;height:7px;border-radius:4px;background:var(--wbd2);opacity:.6}
/* the pane's own inner column: the same box .pw gives the advanced view */
.sv-main{height:100%;min-height:0;width:100%;display:flex;flex-direction:column;padding:0;font-family:var(--wsans);color:var(--wt)}
.sv-main b{font-weight:700}
/* the page's own section rule (70px and a rule above) is not for these */
.sv-screen{display:none;flex-direction:column;gap:0;flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;
border:1px solid var(--wbd);border-radius:8px;}
/* ONE section per screen, on the calculator's own edges (its four sections span the same
   box, 8px corners): the parts inside are flat and parted by hairlines rather than
   floating as separate cards; spare room is shared out between the parts, so the box
   has no dead band anywhere - on Network the list grows into the room instead */
.sv-screen>.sv-panel{background:transparent;}

.sv-screen{justify-content:space-between}

.sv-screen .sv-card{border:0;border-radius:0;background:transparent;padding:2px 18px}
.sv-screen .sv-card:first-child{padding-left:0}

/* the parts every screen is built from */
.sv-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.sv-cards.four{grid-template-columns:repeat(4,minmax(0,1fr))}
.sv-card{border:1px solid var(--wbd);border-radius:12px;background:var(--wc);padding:12px 14px 13px;display:flex;flex-direction:column;gap:5px;position:relative;min-width:0}
.sv-k{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv-big{font-weight:800;letter-spacing:-.022em;line-height:1.05;font-variant-numeric:tabular-nums;display:flex;align-items:baseline;gap:8px;min-width:0}
.sv-big em{font-style:normal;}
.sv-big.sm{font-size:22px}
.sv-sub{color:var(--ws);min-height:16px}
.sv-sub s{text-decoration:none;color:var(--wf)}
.sv-tag{display:inline-flex;align-items:center;gap:5px;
border-radius:99px;border:1px solid var(--wbd2);color:var(--ws);white-space:nowrap}
.sv-tag.g{color:var(--wgreen);border-color:rgba(46,224,106,.38);background:rgba(46,224,106,.06)}
.sv-tag.a{color:var(--wamber);border-color:rgba(255,176,46,.38);background:rgba(255,176,46,.06)}
.sv-tag.r{color:var(--wburn);border-color:rgba(255,77,31,.38);background:rgba(255,77,31,.06)}

.sv-panel{border:1px solid var(--wbd);border-radius:12px;background:var(--wc);padding:13px 15px 14px;display:flex;flex-direction:column;gap:10px;min-width:0}
.sv-ph{display:flex;align-items:center;gap:11px;flex-wrap:wrap;min-width:0}
.sv-ph h3{margin:0;letter-spacing:-.01em}
.sv-ph .sv-rt{margin-left:auto;display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:9px;min-width:0}
.sv-note{color:var(--ws);line-height:1.5}
.sv-note b{color:var(--wt)}
/* the four figures of the opportunity, and the button that signs it */

.sv-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--wbd2);padding:0 20px;
color:var(--wt);background:var(--wchip);cursor:pointer;
white-space:nowrap;transition:color .16s,border-color .16s,background .16s;position:relative}
.sv-btn:hover:not(:disabled){border-color:var(--wcyan);color:var(--wcyan)}
.sv-btn:focus-visible{outline:2px solid var(--wcyan);outline-offset:2px}
.sv-btn:disabled{color:var(--wf);cursor:default}

.sv-btn.red{color:var(--wburn);border-color:rgba(255,77,31,.32)}
.sv-btn.red:hover:not(:disabled){border-color:var(--wburn);color:var(--wburn);background:rgba(255,77,31,.09)}
.sv-btn.sml{border-radius:8px}
/* the wallet doors read as names, not as shouted labels */
.sv-btn.w{text-transform:none;letter-spacing:.01em;font-family:var(--wsans);font-size:13px;gap:9px}
.sv-btn.w img{width:16px;height:16px}
.sv-btn.w i{font-style:normal;color:var(--wf)}
.sv-btn.busy{color:transparent!important}
.sv-btn.busy::after{content:"";position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;
border:2px solid rgba(255,255,255,.25);border-top-color:var(--wt);animation:wkspin .8s linear infinite}
/* the allocation: one bar, then the validators that make it */

.sv-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));}
.sv-chip{display:grid;align-items:center;
min-width:0}

.sv-chip b{font-size:13px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv-chip em{font-style:normal;justify-self:end}
.sv-chip s{grid-column:2;text-decoration:none;font-variant-numeric:tabular-nums}
.sv-chip u{grid-column:3;text-decoration:none;color:var(--wf);justify-self:end}
.sv-chip.skel b,.sv-chip.skel em,.sv-chip.skel s,.sv-chip.skel u{height:7px;border-radius:4px;background:var(--wbd2);opacity:.5}
.sv-chip.skel b{width:64%}.sv-chip.skel em{width:22px}.sv-chip.skel s{width:52%}.sv-chip.skel u{width:26px}

.sv-chip.click{cursor:pointer;transition:border-color .16s}

/* the line under a screen: state, then what to do about it */

/* the set, as a table */

.sv-wrap{overflow-x:auto}
/* the Network list: the head and the figures stand, the list takes the rest of the
   window and scrolls inside itself - its search and its column heads stay put, its
   count line stays under it, and the panel's end is always on screen. Below 240px of
   room the screen itself scrolls rather than squeezing the list to nothing. */

/* this screen's figures give the list more of the window: tighter cards, tighter rows */
.sv-screen[data-sc=net] .sv-card{gap:3px}
.sv-screen[data-sc=net] .sv-big{font-size:23px}

/* the phone's own four columns: fixed widths, the name cell takes the rest and ellipsises */

.sv-ok{color:var(--wgreen)}

.sv-bad{color:var(--wburn)}
.sv-dim{color:var(--wf)}

/* the autopilot screen: what stands, what it may do, what it may never do */

.sv-can{flex-wrap:wrap;}
.sv-can div{display:flex;flex-direction:column;gap:5px;min-width:0}
.sv-can u{text-decoration:none;}
.sv-can p{margin:0;display:flex;gap:14px;flex-wrap:wrap}
.sv-can p span{display:inline-flex;align-items:center;gap:6px}
/* ══ Simple view, second pass (2026-09-25): depth, colour with meaning, one hero ══════════
   The calculator takes its colour from its content (the map, the gradient tracks); this view
   has none of that, so it gets its own. Three levels of depth - the page ground, a lifted
   slate card on the calculator's edges, raised tiles inside it - so groups read without
   lines; a tinted badge per figure; one green hero with a solid action where the gain is;
   labels in sentence case a person reads at a glance. Scoped to #sv: Advanced keeps its look. */

.sv-screen{padding:16px 18px;box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
.sv-screen>:not(:first-child){border-top:0;margin-top:14px;padding-top:0}
.sv-screen>.sv-panel{background:var(--wh);border:1px solid var(--wbd);border-radius:12px;padding:14px 16px}
.sv-screen .sv-cards{gap:12px}
.sv-screen .sv-card,.sv-screen .sv-card:first-child{background:var(--wh);border:1px solid var(--wbd);border-radius:12px;padding:14px 16px}
.sv-screen .sv-card+.sv-card{border-left:1px solid var(--wbd)}

.sv-sub{font-size:12px}
.sv-tag{font-family:var(--wsans);font-size:11px;font-weight:600;letter-spacing:0;text-transform:none;padding:4px 10px}
.sv-ph h3{font-size:16.5px;font-weight:700}
.sv-note{font-size:12.5px}
.sv-btn{font-family:var(--wsans);font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;height:40px;border-radius:10px}
.sv-btn.sml{font-size:12px;height:32px;padding:0 14px}
/* the one action the page is about: solid, and lit */
.sv-btn.go{background:#2ee06a;border-color:#2ee06a;color:#05170c;box-shadow:0 10px 26px -14px rgba(46,224,106,.9)}
.sv-btn.go:hover:not(:disabled){background:#52ea88;border-color:#52ea88;color:#05170c}
.sv-btn.pri{background:#ffb02e;border-color:#ffb02e;color:#1d1300}
.sv-btn.pri:hover:not(:disabled){background:#ffc25a;border-color:#ffc25a;color:#1d1300}
/* the hero: the gain on a green wash, its figures as inset tiles */
#sv-optp.hero{background:radial-gradient(120% 160% at 0% 0%,rgba(46,224,106,.17),rgba(46,224,106,0) 55%),linear-gradient(120deg,rgba(43,200,189,.07),rgba(43,200,189,0) 60%),var(--wh);
border-color:rgba(46,224,106,.3)}

/* the allocation reads as data: a thicker bar in parted segments, chips inset in their tile */

.sv-chip{border-color:var(--wbd)}
.sv-chip em{font-family:var(--wsans);}

/* status: a dot that says on or off, not a sentence in grey */

/* the network and autopilot screens speak the same type */

/* a desktop window is the calculator's box, so every screen has to fit it whole: tiles sized to
   the frame, and the chips one row that scrolls sideways when a stake spans many validators
   (a wrapped second row would push the last part out of the box) */
@media(min-width:901px){
  .sv-screen{padding:14px 16px}
  .sv-screen>:not(:first-child){margin-top:12px}
  .sv-screen>.sv-panel{padding:12px 16px;gap:9px}
  .sv-screen .sv-card,.sv-screen .sv-card:first-child{padding:12px 16px}

.sv-btn{height:36px}

.sv-chips{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(160px,1fr);overflow-x:auto;scrollbar-width:thin}
  .sv-chip{padding-top:7px;padding-bottom:7px}
}
/* a short window (a laptop at 720-800px) shrinks the calculator's box with it: the same parts, closer */
@media(min-width:901px) and (max-height:820px){
  .sv-screen{padding:10px 14px}
  .sv-screen>:not(:first-child){margin-top:9px}
  .sv-screen>.sv-panel{padding:9px 14px;gap:7px}
  .sv-screen .sv-card,.sv-screen .sv-card:first-child{padding:9px 14px}

.sv-btn{height:32px}
  .sv-ph h3{font-size:15px}

/* Network at 720px tall: its head and four cards leave the list 238px, and a 240px floor
     pushed the screen 2px past its box */
  
}
@media(max-width:900px){.sv-screen .sv-card+.sv-card{border-left:1px solid var(--wbd)}}
.sv-can p span::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;flex:0 0 auto}
@media(max-width:900px){
  .sv-cards,.sv-cards.four{grid-template-columns:repeat(2,minmax(0,1fr))}
  .sv-screen .sv-cards{gap:10px}
  .sv-screen .sv-card,.sv-screen .sv-card:first-child,.sv-screen .sv-card+.sv-card{border:1px solid var(--wbd);border-radius:9px;padding:10px 12px}
  
  .sv-who{margin-left:auto;flex:0 0 auto}
}
@media(max-width:620px){
  .sv-main{padding:0 0 24px}
  /* no window to fill on a phone: the parts simply stack */
  .sv-screen{justify-content:flex-start}
  .sv-cards,.sv-cards.four{grid-template-columns:minmax(0,1fr)}
  
  /* a phone: the lockup keeps its whole tagline; the greeting takes the line under it */
  .brandbar .sv-brand{flex-wrap:wrap;row-gap:6px}
  .welc{flex:1 1 100%;margin-left:0;padding-left:0;border-left:0}
  
  .sv-chips{grid-template-columns:minmax(0,1fr)}
}
/* ══ Simple view, third pass (2026-09-26): the theme's own surfaces, heat as the colour of meaning ══
   The operator: the simple view read "too dull ... away from theme", harder than Advanced.
   So it takes back the window's violet-navy surfaces (the slate of the second pass is gone),
   the calculator's type for labels (mono, uppercase, spaced), and colour means one thing each:
     heat    the map's own ramp: where a validator, a stake, a plan sits - brighter pays more
     amber   yours: the stake, the wallet, the first step
     green   what you gain, and the one move that gains it
     violet  Autopilot            teal   the set, the network
   Every tile and panel wears its meaning the way Advanced's tiles do: a gradient hairline on
   its top edge, and a heading behind a short bar of the same colour (--tc). */
#sv,#sd-mstrip{--wc:#0e0e1d;--wh:#12122a;--wi:#0a0a16;--wchip:#101024;--wbd:#232342;--wbd2:#34345c;--wt:#f0eef8;--ws:#c1bfdc;--wf:#8f8db4;
--sv-amber:#ffb02e;--sv-green:#2ee06a;--sv-violet:#b9b0ff;--sv-teal:#2bc8bd;--sv-pho:#7fd8ff}
.sv-screen{background:linear-gradient(180deg,#0d0d1c,#09090f);border-color:#232342}
.sv-screen>.sv-panel,.sv-screen .sv-card,.sv-screen .sv-card:first-child,.sv-screen .sv-card+.sv-card{
background:linear-gradient(180deg,#131329,#0c0c1a);border:1px solid var(--wbd2);box-shadow:inset 0 1px 0 #ffffff08;position:relative}
.sv-screen>.sv-panel::before,.sv-screen .sv-card::before{content:"";position:absolute;left:16px;right:16px;top:0;height:1px;
background:linear-gradient(90deg,transparent,var(--tc,#6f66c8),transparent);opacity:.95;pointer-events:none}

#sv-optp{--tc:var(--sv-green)}#sv-allocp,#sv-atalloc{--tc:var(--sv-amber)}#sv-atp,#sv-atp .sv-card,#sv-atauth{--tc:var(--sv-violet)}

/* the wallet tile: liquid ATONE, the PHOTON that pays fees, when it was read, and the one control
   that reads it again */
.sv-pho{color:#7fd8ff;font-weight:600}

/* network uptime, live: one bar per block (oldest left, now right), the signed share teal and the
   missing share red; the set's 30-day average dashed; a block someone missed carries their mark.
   The plot, the title and the stats share the panel's edges. */
#sv-up,#sv-netcards .sv-card{--tc:var(--sv-teal)}
.sv-screen>.sv-up{flex:1 1 auto;min-height:0}
.sv-on{color:var(--sv-green)}.sv-off{color:var(--wf)}
.sv-upwin{font-family:var(--wmono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ws)}
.sv-upchart{flex:1 1 auto;min-height:120px;display:flex;flex-direction:column;gap:4px}
.sv-upmarks{position:relative;height:22px;flex:0 0 auto}
.sv-upm{position:absolute;bottom:0;display:inline-flex;align-items:center;gap:5px;transform:translateX(-10px);white-space:nowrap;font-size:10.5px;color:#ff9a7a}
.sv-upm.rt{transform:translateX(calc(-100% + 10px));flex-direction:row-reverse}
.sv-upm b{font-weight:600}
.sv-uplg{width:20px;height:20px;border-radius:6px;overflow:hidden;flex:0 0 auto;box-shadow:0 0 0 1.5px #ff4d1f}
.sv-uplgs{display:inline-flex;flex:0 0 auto}
.sv-uplgs .sv-uplg+.sv-uplg{margin-left:-7px}
.sv-upm.rt .sv-uplgs{flex-direction:row-reverse}
.sv-upm.rt .sv-uplgs .sv-uplg+.sv-uplg{margin-left:0;margin-right:-7px}
.sv-uplg img,.sv-uplg .lg{width:20px;height:20px;display:grid;place-items:center;object-fit:cover;font-size:9px;font-weight:700;color:#fff}
.sv-upplot{position:relative;flex:1 1 auto;min-height:0;border-bottom:1px solid var(--wbd2);cursor:crosshair}
.sv-upbars{position:absolute;inset:0;display:flex;align-items:flex-end;gap:2px}
.sv-upbars i{flex:1 1 0;min-width:1px;height:100%;position:relative;border-radius:2px 2px 0 0;background:rgba(255,77,31,.0)}
.sv-upbars i::before{content:"";position:absolute;left:0;right:0;bottom:0;height:var(--h);border-radius:2px 2px 0 0;background:linear-gradient(180deg,rgba(43,200,189,.95),rgba(43,200,189,.35))}
.sv-upbars i.miss{background:linear-gradient(180deg,rgba(255,77,31,.85),rgba(255,77,31,.5))}
.sv-upbars i.miss::before{background:linear-gradient(180deg,rgba(43,200,189,.7),rgba(43,200,189,.3))}
.sv-upbars i.tip::before{background:linear-gradient(180deg,#7ff0e6,rgba(43,200,189,.5));box-shadow:0 0 12px rgba(43,200,189,.6)}
.sv-upbars i.on{outline:1px solid var(--wt);outline-offset:1px}
.sv-upy{position:absolute;left:4px;transform:translateY(50%);z-index:1;font-family:var(--wmono);font-size:9px;color:var(--wt);background:rgba(9,9,15,.7);padding:1px 4px;border-radius:3px;pointer-events:none}
/* the set's 30-day average: long dashes, full strength, a dark edge so it reads over any bar,
   and its value at the right end */
.sv-upref{position:absolute;left:0;right:0;height:1.5px;margin-bottom:-.75px;z-index:2;pointer-events:none;
background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--wt) 80%,transparent) 0 6px,transparent 6px 11px);filter:drop-shadow(0 0 1px rgba(0,0,0,.7))}
.sv-upref b,.sv-pavg b{position:absolute;right:0;bottom:5px;font-family:var(--wmono);font-size:10px;font-weight:600;color:var(--wt);
background:var(--wc);border:1px solid var(--wbd2);padding:1px 6px;border-radius:4px;white-space:nowrap}
.sv-uptip{position:absolute;top:8px;width:24%;min-width:180px;padding:7px 10px;border:1px solid var(--wbd2);border-radius:8px;background:#15152c;font-size:11px;line-height:1.45;color:var(--ws);pointer-events:none;z-index:3}
.sv-uptip b{display:block;color:var(--wt);font-weight:700}
.sv-upx{display:flex;justify-content:space-between;font-family:var(--wmono);font-size:9px;letter-spacing:.06em;color:var(--wf)}
.sv-upwait{flex:1 1 auto;display:grid;place-items:center;color:var(--wf);font-size:12px;min-height:90px}
.sv-upx i{font-style:normal}
@media(max-width:620px){
  .sv-screen>.sv-up{min-height:360px}.sv-upchart{min-height:190px}.sv-upm b{display:none}
  #sv-up .sv-rt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%;gap:6px;margin-left:0}
  .sv-upx .bn{display:none}
}
/* the wallet header: the total on the left, large; on the right one bar that splits it (staked amber,
   available violet, rewards green) with the three figures under it; the fee token and freshness
   along the foot. One panel where there were four tiles, so the page has a first thing to read */
#sv-wal{--tc:var(--sv-violet);grid-template-columns:minmax(0,.9fr) minmax(0,1.4fr);column-gap:28px;}


.sv-wbar{display:flex;gap:3px;height:10px}
.sv-wbar i{display:block;min-width:3px;border-radius:3px}
.sv-wbar i.none{flex:1;background:var(--wbd)}
.sv-wbar i.stk{background:linear-gradient(90deg,#ffb02e,#ffc861)}
.sv-wbar i.bal{background:#b9b0ff}
.sv-wbar i.rew{background:#2ee06a}

/* the move: three columns divided by hairlines, no boxes inside the panel; the gain carries the green */

@media(max-width:900px){#sv-wal{grid-template-columns:minmax(0,1fr);row-gap:14px}
  }

/* a wallet with nothing staked: the message and Stake ATONE in the middle of the space below the tiles */
#sv-optp.fill{flex:1 1 auto;justify-content:center;align-items:center}
.sv-none{display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
.sv-none h3{margin:0;font-size:18px;font-weight:700}
.sv-mbar{overflow:hidden}
/* the rest of a long list, as one card that opens Manual */
.sv-chip.more .sv-lgo{display:grid;place-items:center;background:var(--wbd);color:var(--ws);font-family:var(--wmono);font-size:10px;font-weight:700}
.sv-chip.more u{color:var(--sv-violet)}

/* labels in the calculator's voice; figures in the colour of what they are */
.sv-k{font-family:var(--wmono);font-size:9.5px;font-weight:400;letter-spacing:.16em;text-transform:uppercase;color:var(--ws)}
.sv-big em{font-family:var(--wmono);font-size:10px;font-weight:400;letter-spacing:.14em;text-transform:uppercase;color:var(--wf)}

.sv-ph h3{display:inline-flex;align-items:center;gap:9px}
.sv-ph h3::before{content:"";width:3px;height:15px;border-radius:2px;background:var(--tc,#6f66c8);box-shadow:0 0 10px -1px var(--tc,#6f66c8)}
.sv-tag.q{font-family:var(--wmono);font-size:9px;font-weight:400;letter-spacing:.12em;text-transform:uppercase;color:var(--ws);border-color:var(--wbd2)}
/* the heat scale, on one line: the lowest rate the set pays, the map's ramp with a rug of
   every validator above it, the median, the reader's validators as pins; the highest rate */
.sv-hrow{display:flex;align-items:center;gap:12px;min-width:0}
.sv-hl{font-family:var(--wmono);font-size:10px;letter-spacing:.04em;color:var(--ws);white-space:nowrap;flex:0 0 auto}
.sv-heat{position:relative;flex:1 1 auto;min-width:0;height:26px}
.sv-heat>i{position:absolute;left:0;right:0;top:12px;height:6px;border-radius:3px;box-shadow:0 0 14px -3px rgba(250,167,34,.45)}
.sv-heat>s{position:absolute;top:4px;width:1px;height:5px;background:rgba(255,255,255,.3);transform:translateX(-.5px);text-decoration:none}
.sv-heat>u{position:absolute;top:8px;width:2px;height:14px;border-radius:1px;background:var(--wt);opacity:.8;transform:translateX(-1px)}
.sv-heat>b{position:absolute;top:15px;width:var(--s);height:var(--s);border-radius:50%;background:var(--c);border:2px solid #0b0b18;
box-shadow:0 0 0 1.5px var(--wt),0 0 14px var(--c);transform:translate(-50%,-50%)}
.sv-hrow.mini{gap:8px;margin-top:6px}
.sv-hrow.mini .sv-hl{font-size:9px;color:var(--wf)}
.sv-hrow.mini .sv-heat{height:16px}
.sv-hrow.mini .sv-heat>i{top:5px;height:5px}
.sv-hrow.mini .sv-heat>u{top:1px;height:13px}
.sv-hrow.mini .sv-heat>b{top:7.5px}

.sv-hint{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;color:var(--ws);white-space:nowrap}
.sv-hint i{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.sv-hint i.lo{background:#572179;box-shadow:0 0 0 1px #8a5bb8}
.sv-hint i.hi{background:#ffd662;margin-left:9px;box-shadow:0 0 8px #ffd66288}
/* the plan: now -> after -> a year */

.sv-mbar{display:flex;gap:2px;height:7px;margin-top:auto;padding-top:5px}
.sv-mbar em{display:block;border-radius:3px;min-width:4px;height:7px}

/* a first visit: three steps, in the colours they carry on the screen */
.sv-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;counter-reset:st}
.sv-steps li{counter-increment:st;display:flex;flex-direction:column;gap:3px;padding:11px 14px 12px 46px;position:relative;border:1px solid rgba(255,255,255,.07);
border-radius:10px;background:rgba(8,8,18,.55);min-width:0}
.sv-steps li::before{content:counter(st);position:absolute;left:13px;top:11px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;
font-family:var(--wmono);font-size:11px;font-weight:700;color:#0b0b18;background:var(--sc);box-shadow:0 0 14px -2px var(--sc)}
.sv-steps b{font-size:13.5px;color:var(--wt)}
.sv-steps span{font-size:11.5px;color:var(--ws);line-height:1.4}
/* a validator the stake sits on: its heat along the left edge and in its APR */
.sv-chips{gap:8px}
.sv-chip{grid-template-columns:auto minmax(0,1fr) auto;gap:1px 10px;padding:8px 12px 8px 13px;border-radius:10px;background:rgba(8,8,18,.55);border:1px solid var(--wbd);position:relative;overflow:hidden}
.sv-chip::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--c,var(--wbd2))}
.sv-chip .sv-lgo{grid-row:span 2;width:26px;height:26px;border-radius:8px;overflow:hidden;display:block;flex:0 0 auto}
.sv-chip .sv-lgo img,.sv-chip .sv-lgo .lg{width:26px;height:26px;display:grid;place-items:center;object-fit:cover;font-size:10px;font-weight:700;color:#fff}
.sv-chip em{font-size:15px;font-weight:800;color:var(--wt);font-variant-numeric:tabular-nums}
.sv-chip em small{font-size:10px;font-weight:500;color:var(--wf);margin-left:1px}
.sv-chip s{font-family:var(--wmono);font-size:9.5px;color:var(--wf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv-chip u{font-family:var(--wmono);font-size:11px;font-weight:700}
.sv-chip.hld{opacity:.78}
.sv-chip.click:hover{border-color:var(--c,var(--wbd2))}
.sv-chip.skel .sv-lgo{background:var(--wbd2);opacity:.5}
/* the screen's parts keep their size: shrinking to fit only hid an overflow (the parts squeezed,
   their content spilled over the next one, and scrollHeight still matched). Only the network
   list gives way, and it scrolls inside itself */
.sv-screen>*{flex-shrink:0}

.sv-screen .sv-card,.sv-screen .sv-card:first-child,.sv-screen .sv-card+.sv-card{padding-top:12px;padding-bottom:12px}
.sv-big{font-size:28px;margin-top:4px}

/* the footer: a line, not a box - status, freshness, the two plain controls */
/* Autopilot's own colour */

.sv-btn.vio{background:var(--sv-violet);border-color:var(--sv-violet);color:#161038}
.sv-btn.vio:hover:not(:disabled){background:#cfc8ff;border-color:#cfc8ff;color:#161038}
/* what the grant allows: two boxes, green and red, so "may" and "may never" cannot be misread */
.sv-can{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;font-size:12px}
.sv-can>div{padding:10px 14px 11px;border-radius:10px;border:1px solid rgba(46,224,106,.3);background:rgba(46,224,106,.05);gap:7px}
.sv-can>div+div{border-color:rgba(255,77,31,.3);background:rgba(255,77,31,.05)}
.sv-can u{font-family:var(--wmono);font-size:9px;font-weight:400;letter-spacing:.16em;text-transform:uppercase;color:var(--sv-green)}
.sv-can>div+div u{color:#ff7a57}
/* the set: APR in the map's colour, the reader's rows marked in amber */

/* the lockup: the mark and one line beside it (the word GATA is gone, the mark says it) */
.sv-bw{align-items:center}
/* the calculator's own title markup (.bt/.btx/.nk/.tsfx), so the line is "Nakamoto Bonus" to the
   pixel in both themes: its size, weight, face; the last words in the section's amber */
.sv-bw .bt{flex-wrap:nowrap}
.sv-brand .tsfx{color:#ffb02e}
/* the title follows the Staking | Governance switch */
.sv-brand .grp-g,html[data-sv="dashboard/governors"] .sv-brand .grp-s{display:none}
html[data-sv="dashboard/governors"] .sv-brand .grp-g{display:inline}
.sv-brand{gap:12px}
/* Self has no Autopilot line: the row is kept, hidden, because its button (#atbtn) is the door
   the Autopilot screen opens the setup card through */
#wkap{display:none!important}
@media(max-width:900px){

.sv-steps{grid-template-columns:minmax(0,1fr)}
}
@media(max-width:620px){

.sv-can{grid-template-columns:minmax(0,1fr)}
  
}
@media(min-width:901px) and (max-height:820px){
  .sv-steps li{padding-top:7px;padding-bottom:8px}

.sv-heat{height:20px}
  .sv-heat>i{top:7px}.sv-heat>s{top:4px}.sv-heat>u{top:1px}.sv-heat>b{top:10px}
  .sv-chip{padding-top:5px;padding-bottom:5px}
}
/* the rewards box on Manual opens the claim card: it lifts on hover and carries a chevron,
   and stays quiet while there is nothing to claim */
#wk-mine .wk-b5.wk-clk{cursor:pointer;transition:border-color .15s,background .15s}
#wk-mine .wk-b5.wk-clk[aria-disabled=true]{cursor:default}
#wk-mine .wk-b5.wk-clk:not([aria-disabled=true]):hover{border-color:rgba(46,224,106,.55);background:linear-gradient(180deg,#132a1f,#0b1812)}
#wk-mine .wk-b5.wk-clk:focus-visible{outline:2px solid #2ee06a;outline-offset:2px}
#wk-mine .wk-b5.wk-clk::after{content:"";position:absolute;right:7px;top:50%;width:4px;height:4px;border-top:1.5px solid #2ee06a;border-right:1.5px solid #2ee06a;
transform:translateY(-50%) rotate(45deg);opacity:.6;pointer-events:none}
#wk-mine .wk-b5.wk-clk:not([aria-disabled=true]):hover::after{opacity:1}
#wk-mine .wk-b5.wk-clk[aria-disabled=true]::after{content:none}
/* the claim card: the unstake card's rows, with square ticks since several can be chosen */
.clcard .unpick{max-height:300px}
.clcard .unrow input{border-radius:3px}
.clcard .unrow input:checked::after{border-radius:1px}
.clcard .unrow i{color:#5cf08e}
/* the claim button inside the wallet's rewards box */
.sv-box .sv-bact{position:absolute;top:8px;right:8px;height:24px;padding:0 10px;border-radius:7px;border:1px solid rgba(46,224,106,.45);background:rgba(46,224,106,.1);
color:#5cf08e;font-family:var(--wmono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.sv-box .sv-bact:hover{background:#2ee06a;border-color:#2ee06a;color:#062a14}
.sv-box .sv-bact:focus-visible{outline:2px solid #2ee06a;outline-offset:2px}
/* ══ Wallet: a dashboard, not a page ═══════════════════════════════════════════════════
   Three panels in one frame, 12px apart and no more: the wallet across the top, then the move
   (left) and the validators holding the stake (right) side by side, filling what is left. Every
   figure sits in a shaded box (.sv-box) - a coloured tick and a mono label, the value, a line of
   detail - the same box in every panel, so the page reads as one instrument. */
#sv-over{justify-content:flex-start;gap:12px}
#sv-over>*,#sv-over>*:not(:first-child){margin-top:0}
.sv-row2{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:12px;flex:1 1 auto;min-height:0}
.sv-row2:has(> #sv-allocp[hidden]){grid-template-columns:minmax(0,1fr)}
.sv-row2>.sv-panel{background:linear-gradient(180deg,#131329,#0c0c1a);border:1px solid var(--wbd2);border-radius:12px;box-shadow:inset 0 1px 0 #ffffff08;
position:relative;padding:14px 16px;gap:12px;min-height:0}
.sv-row2>.sv-panel::before{content:"";position:absolute;left:16px;right:16px;top:0;height:1px;
background:linear-gradient(90deg,transparent,var(--tc,#6f66c8),transparent);opacity:.95;pointer-events:none}
#sv-wal{display:flex;flex-direction:column;align-items:stretch;gap:12px;text-align:left}
#sv-wal .sv-ph{justify-content:flex-start}
#sv-wal .sv-ph h3{min-width:0;max-width:60%}
.sv-wn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#sv-wal .sv-wbar{height:8px}
.sv-boxes{display:grid;gap:10px;min-width:0}
.sv-boxes.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.sv-boxes.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.sv-boxes.four{grid-template-columns:minmax(0,1.25fr) repeat(3,minmax(0,1fr))}
.sv-boxes.four.eq{grid-template-columns:repeat(4,minmax(0,1fr))}
.sv-boxes.eq .sv-bm{white-space:normal;line-height:1.35}
.sv-mv.eq .sv-bv{font-size:30px}
.sv-box{--bc:var(--wbd2);display:flex;flex-direction:column;gap:4px;min-width:0;padding:11px 14px 12px;border-radius:10px;
border:1px solid var(--wbd);background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012)),#0a0a17;position:relative;overflow:hidden}
.sv-bl{display:flex;align-items:center;gap:7px;font-family:var(--wmono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ws);white-space:nowrap}
.sv-bl::before{content:"";width:7px;height:7px;border-radius:2px;background:var(--bc);flex:0 0 auto}
.sv-bv{display:flex;align-items:baseline;gap:7px;font-size:22px;font-weight:800;letter-spacing:-.022em;line-height:1.15;color:var(--wt);
font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv-bv em{font-style:normal;font-family:var(--wmono);font-size:10px;font-weight:400;letter-spacing:.14em;color:var(--wf)}
.sv-bm{font-size:11.5px;color:var(--wf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:15px}
.sv-bm b{font-weight:700}
.b-stk{--bc:#ffb02e}.b-bal{--bc:#b9b0ff}.b-rew{--bc:#2ee06a}.b-hi{--bc:#ffd662}.b-cool{--bc:#ffb02e}
.b-tot{--bc:#f0eef8;background:radial-gradient(130% 140% at 0% 0%,rgba(185,176,255,.14),rgba(185,176,255,0) 60%),linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.012)),#0a0a17;border-color:var(--wbd2)}
.b-tot .sv-bv{font-size:27px}
.b-stk .sv-bv{color:#ffc861}.b-rew .sv-bv{color:#5cf08e}
.b-aft{border-color:rgba(46,224,106,.3)}
.b-gain{--bc:#2ee06a;justify-content:center;background:linear-gradient(135deg,rgba(46,224,106,.18),rgba(46,224,106,.04)),#0a0a17;border-color:rgba(46,224,106,.4)}
.b-gain .sv-bv{color:var(--sv-green);font-size:26px}
.sv-box .sv-mbar{display:flex;gap:2px;height:auto;margin-top:auto;padding-top:8px}
.sv-box .sv-mbar em{height:7px}
.sv-mv{flex:1 1 auto;min-height:0}
.sv-mv .sv-box{justify-content:center;gap:5px}
.sv-mv .sv-box .sv-mbar{margin-top:10px;padding-top:0}
.sv-mv .sv-bv{font-size:34px}
.sv-mv .b-gain .sv-bv{font-size:28px}
.sv-mvnote{font-size:11.5px;color:var(--wf)}
#sv-optp .sv-note{margin-top:auto}
.sv-jail{font-size:12px;line-height:1.5;color:var(--ws);padding:7px 12px;border-radius:8px;border:1px solid rgba(255,176,46,.35);background:rgba(255,176,46,.07)}
.sv-jail b{color:var(--sv-amber);font-weight:700}
/* the steps a first visit sees, one under another in the narrower column */
.sv-steps.col{grid-template-columns:minmax(0,1fr);gap:8px}
/* the validators: the scale, its key, then one shaded row each */
#sv-allocp .sv-hrow.mini{margin-top:2px}
#sv-allocp .sv-hint{white-space:normal;flex-wrap:wrap;row-gap:4px}
.sv-vlist{flex:1 1 auto;min-height:0;display:grid;grid-auto-rows:minmax(30px,44px);align-content:start;gap:6px}
.sv-vr{--c:var(--wbd2);display:grid;grid-template-columns:24px minmax(0,1fr) auto minmax(60px,.7fr) 54px;align-items:center;gap:12px;
padding:0 12px 0 13px;border-radius:10px;border:1px solid var(--wbd);background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01)),#0a0a17;
position:relative;overflow:hidden;min-width:0;min-height:0}
.sv-vr::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--c)}
.sv-vr .sv-lgo{width:24px;height:24px;border-radius:7px;overflow:hidden;display:grid;place-items:center}
.sv-vr .sv-lgo img,.sv-vr .sv-lgo .lg{width:24px;height:24px;display:grid;place-items:center;object-fit:cover;font-size:10px;font-weight:700;color:#fff}
.sv-vn{font-size:13px;font-weight:700;color:var(--wt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.sv-va{text-decoration:none;font-family:var(--wmono);font-size:11px;color:var(--ws);white-space:nowrap;font-variant-numeric:tabular-nums}
.sv-va em{font-style:normal;font-size:8px;letter-spacing:.12em;color:var(--wf);margin-left:5px}
.sv-vs{display:flex;align-items:center;gap:8px;min-width:0}
.sv-vt{flex:1 1 auto;height:6px;border-radius:3px;background:var(--wbd);overflow:hidden}
.sv-vt i{display:block;height:100%;border-radius:3px;background:var(--c)}
.sv-vs em{font-style:normal;font-family:var(--wmono);font-size:10.5px;color:var(--ws);min-width:30px;text-align:right}
.sv-vr u{text-decoration:none;font-family:var(--wmono);font-size:12px;font-weight:700;text-align:right;white-space:nowrap}
.sv-vr.click,.sv-vr.more{cursor:pointer}
.sv-vr.click:hover,.sv-vr.more:hover{border-color:var(--c)}
.sv-vr:focus-visible{outline:2px solid var(--sv-amber);outline-offset:2px}
.sv-vr.more .sv-lgo{background:var(--wbd);color:var(--ws);font-family:var(--wmono);font-size:10px;font-weight:700}
.sv-vr.more u{color:var(--sv-amber);font-weight:400;font-size:10.5px;letter-spacing:.06em}
.sv-vr.skel .sv-lgo{background:var(--wbd2);opacity:.5}
.sv-vr.skel .sv-vn,.sv-vr.skel .sv-va,.sv-vr.skel u{display:block;height:9px;border-radius:3px;background:var(--wbd)}
.sv-vr.skel .sv-vn{width:60%}.sv-vr.skel .sv-va{width:60px}
@media(min-width:901px) and (max-height:820px){
  #sv-over,.sv-row2{gap:10px}
  .sv-box{padding:8px 12px 9px;gap:2px}
  .sv-bv{font-size:20px}.b-tot .sv-bv{font-size:23px}.b-gain .sv-bv{font-size:22px}
  .sv-row2>.sv-panel{padding:11px 14px;gap:9px}
  .sv-vlist{gap:5px}.sv-mv .sv-bv{font-size:25px}.sv-mv .b-gain .sv-bv{font-size:21px}
}
@media(max-width:900px){
  .sv-row2{grid-template-columns:minmax(0,1fr);flex:0 0 auto}
  .sv-boxes.four,.sv-boxes.four.eq{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:620px){
  .sv-boxes.three{grid-template-columns:repeat(2,minmax(0,1fr))}
  .sv-boxes.three>.b-gain{grid-column:1/-1}
  .sv-bm{white-space:normal}
  .sv-box .sv-bact{position:static;order:3;align-self:flex-start;margin-top:4px}
  .sv-bv{font-size:19px}.b-tot .sv-bv{font-size:22px}
  .sv-vr{grid-template-columns:22px minmax(0,1fr) auto 50px;gap:9px}
  .sv-vr .sv-vs{display:none}
  .sv-vlist{grid-auto-rows:40px}
}
/* ══ Network: four cards, the uptime plot at half height, then who misses blocks beside the
   chain's pace - the same boxes and rows as the wallet ══ */
#sv-net{justify-content:flex-start;gap:12px}
/* the cards, then Uptime and Chain pace as two equal rows: a grid, because in a flex column the
   Uptime panel's own padding came on top of its share and Chain pace ended 26px shorter */
html[data-svs=net] #sv-net{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr);align-content:stretch}
#sv-net>*,#sv-net>*:not(:first-child){margin-top:0}
#sv-netcards{grid-template-columns:repeat(3,minmax(0,1fr))}
#sv-net>.sv-up{flex:1 1 0;min-height:0}
#sv-net .sv-upchart{min-height:0}
#sv-netrow{flex:1 1 0;grid-template-columns:minmax(0,1fr)}
#sv-pace{--tc:var(--sv-teal)}
#sv-pace .sv-box{padding:6px 12px 7px;gap:1px}
#sv-pace{gap:9px}
#sv-pace .sv-bv{font-size:19px}
#sv-pace .sv-bm{font-size:10.5px}
#sv-pace{overflow:hidden}
.sv-pace{flex:1 1 auto;min-height:18px;position:relative;display:flex;align-items:flex-end;gap:2px;border-bottom:1px solid var(--wbd2)}
.sv-pace i{flex:1 1 0;min-width:1px;height:var(--h);border-radius:2px 2px 0 0;background:linear-gradient(180deg,rgba(43,200,189,.9),rgba(43,200,189,.3))}
.sv-pace i.slow{background:linear-gradient(180deg,#ffb02e,rgba(255,176,46,.35))}
.sv-pavg{position:absolute;left:0;right:0;height:1.5px;margin-bottom:-.75px;pointer-events:none;z-index:2;
background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--wt) 80%,transparent) 0 6px,transparent 6px 11px);filter:drop-shadow(0 0 1px rgba(0,0,0,.7))}
@media(min-width:901px) and (max-height:820px){
  #sv-net,#sv-netrow{gap:10px}
  #sv-pace .sv-bv{font-size:16px}
  #sv-pace .sv-bm{display:none}
}
@media(max-width:900px){
  #sv-netcards{grid-template-columns:repeat(2,minmax(0,1fr))}
  #sv-netrow{grid-template-columns:minmax(0,1fr);flex:0 0 auto}
  #sv-net>.sv-up{flex:0 0 auto}
  #sv-net .sv-upchart{min-height:150px}
}
@media(max-width:620px){
  #sv-up .sv-rt{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;gap:8px}
  .sv-pace{height:90px;flex:0 0 auto}
}
/* ══ Network tabs: Signing, Proposers, Activity, Economics - the Uptime panel's stats in
   each heading, a key beside the title, lists that scroll inside their panel ══ */
#sv-sign,#sv-prop,#sv-act,#sv-eco{justify-content:flex-start;gap:12px}
#sv-sign>*,#sv-prop>*,#sv-act>*,#sv-eco>*,#sv-sign>*:not(:first-child),#sv-prop>*:not(:first-child),#sv-act>*:not(:first-child),#sv-eco>*:not(:first-child){margin-top:0}
#sv-signp,#sv-prop24,#sv-act7,#sv-actlive{flex:1 1 0;min-height:0}
#sv-sign .sv-panel,#sv-prop .sv-panel,#sv-act .sv-panel,#sv-eco .sv-panel{--tc:var(--sv-teal)}
.sv-gkey{display:inline-flex;align-items:center;gap:6px;font-family:var(--wmono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--wf);white-space:nowrap}
.sv-gkey i{width:9px;height:9px;border-radius:2px;margin-left:6px}
.sv-gkey i:first-child{margin-left:0}
.sv-gkey i.ok{background:rgba(43,200,189,.6)}.sv-gkey i.bad{background:#ff4d1f}.sv-gkey i.due{width:2px;height:12px;border-radius:1px;background:var(--wt)}
.sv-gkey i.sup{background:var(--sv-amber)}.sv-gkey i.bon{background:rgba(255,176,46,.35)}.sv-gkey i.pho{background:var(--sv-pho)}
.sv-gx{display:flex;justify-content:space-between;gap:10px;font-family:var(--wmono);font-size:9.5px;color:var(--wf);white-space:nowrap}
/* dated ticks: each label where its month begins, with a short tick above it */
.sv-gx.sv-gxt{display:block;position:relative;height:16px}
.sv-gxt span{position:absolute;top:2px;transform:translateX(-50%);padding-top:4px}
.sv-gxt span::before{content:"";position:absolute;left:50%;top:-2px;width:1px;height:5px;background:var(--wbd2)}
.sv-gtip{color:var(--wt);overflow:hidden;text-overflow:ellipsis}
/* Signing: names on the left, one canvas of cells on the right, scrolling together */
.sv-grid{flex:1 1 auto;min-height:0;overflow-y:auto;display:grid;grid-template-columns:190px minmax(0,1fr);column-gap:10px;align-content:start;
scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
.sv-gnames{display:flex;flex-direction:column;min-width:0}
.sv-gn{height:16px;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ws);cursor:pointer;min-width:0}
.sv-gn:hover b{color:var(--wt)}
.sv-gn .sv-lgo{width:12px;height:12px;border-radius:3px;overflow:hidden;flex:0 0 auto}
.sv-gn .sv-lgo img,.sv-gn .sv-lgo .lg{width:12px;height:12px;display:grid;place-items:center;object-fit:cover;font-size:7px;font-weight:700;color:#fff}
.sv-gn b{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1 1 auto}
.sv-gn em{font-style:normal;font-family:var(--wmono);font-size:10px;color:#ff6a3d}
.sv-gn.bad b{color:var(--wt);font-weight:600}
.sv-gcw{min-width:0}
.sv-gc{display:block;cursor:crosshair}
/* Proposers: the latest blocks as logos, newest right; the day's list, due marked */
.sv-plive{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:6px}
.sv-pb{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;cursor:pointer}
.sv-pb .sv-lgo{width:28px;height:28px;border-radius:8px;overflow:hidden}
.sv-pb .sv-lgo img,.sv-pb .sv-lgo .lg{width:28px;height:28px;display:grid;place-items:center;object-fit:cover;font-size:10px;font-weight:700;color:#fff}
.sv-pb b{font-size:9.5px;font-weight:500;color:var(--ws);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv-pb s{text-decoration:none;font-family:var(--wmono);font-size:8.5px;color:var(--wf)}
.sv-pb:last-child .sv-lgo{box-shadow:0 0 0 2px var(--sv-teal)}
@media(max-width:1400px){.sv-pb s{display:none}}
.sv-plist{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:5px;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
.sv-plist .sv-vr{flex:0 0 34px}
.sv-vr u.ok{color:var(--sv-green)}.sv-vr u.warn{color:var(--sv-amber)}.sv-vr u.bad{color:#ff6a3d}
.sv-plist .sv-vr u{color:var(--wt);font-weight:600}
/* a two-way period switch: a groove with the chosen side lit in the section's teal */
.sv-sw{display:inline-flex;padding:2px;border-radius:9px;border:1px solid var(--wbd2);background:rgba(0,0,0,.25);gap:2px}
.sv-sw button{height:24px;padding:0 11px;border:0;border-radius:7px;background:transparent;color:var(--ws);font:500 11.5px var(--wsans);cursor:pointer;white-space:nowrap}
.sv-sw button:hover{color:var(--wt)}
.sv-sw button[aria-pressed=true]{background:linear-gradient(180deg,rgba(43,200,189,.28),rgba(43,200,189,.12));color:var(--wt);box-shadow:inset 0 0 0 1px rgba(43,200,189,.55)}
.sv-sw button:focus-visible{outline:2px solid var(--sv-teal);outline-offset:1px}
/* Activity: bars per hour and per block */
.sv-bars{flex:1 1 auto;min-height:40px;display:flex;align-items:flex-end;gap:1px;border-bottom:1px solid var(--wbd2)}
.sv-bars i{flex:1 1 0;min-width:1px;height:var(--h);border-radius:2px 2px 0 0;background:linear-gradient(180deg,rgba(43,200,189,.9),rgba(43,200,189,.3))}
.sv-bars.live{gap:2px}
.sv-bars.live i{background:linear-gradient(180deg,#b9b0ff,rgba(185,176,255,.3))}
.sv-bars i.z,.sv-bars.live i.z{background:var(--wbd2)}
.sv-bars i.so{opacity:.45;outline:1px dashed var(--wbd2);outline-offset:-1px}
.sv-bx{position:relative;height:14px;font-family:var(--wmono);font-size:9.5px;color:var(--wf)}
.sv-bx span{position:absolute;top:0;white-space:nowrap;padding-left:4px;border-left:1px solid var(--wbd2)}
/* Economics: two line charts */
/* Economics as Uptime: the price cards, then ATONE and PHOTON as two full-width rows */
html[data-svs=eco] #sv-eco{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr);align-content:stretch}
#sv-ecocards{grid-template-columns:repeat(2,minmax(0,1fr))}
#sv-ecocards .sv-card{--tc:var(--sv-amber)}#sv-ecocards .sv-card+.sv-card{--tc:var(--sv-pho)}
.sv-price .sv-sub .up{color:var(--sv-green)}.sv-price .sv-sub .dn{color:#ff6a3d}
.sv-lc{position:relative;flex:1 1 auto;min-height:60px}
.sv-lc svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.sv-lc .gl{stroke:var(--wbd);stroke-width:1;vector-effect:non-scaling-stroke}
.sv-lc .ln{fill:none;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.sv-lc .ln.sup{stroke:var(--sv-amber)}.sv-lc .ln.bon{stroke:rgba(255,176,46,.55)}.sv-lc .ar.bon{fill:rgba(255,176,46,.16)}
.sv-lc .ln.pho{stroke:var(--sv-pho)}.sv-lc .ar.pho{fill:rgba(127,216,255,.14)}
.sv-lc .ln.txl{stroke:var(--sv-teal);stroke-width:1.5}.sv-lc .ar.txl{fill:rgba(43,200,189,.14)}
.sv-lc .ln.tpb{stroke:var(--sv-violet);stroke-width:1.5}.sv-lc .ar.tpb{fill:rgba(185,176,255,.14)}
.sv-bars.hr{gap:4px}
.sv-ly{position:absolute;left:0;transform:translateY(50%);font-family:var(--wmono);font-size:9.5px;line-height:14px;color:var(--ws);background:var(--wc);padding:0 5px;border-radius:3px;pointer-events:none;z-index:1}
.sv-ly:last-of-type{transform:translateY(0)}
.sv-lc{cursor:crosshair}
/* the latest value of each line, marked at the right end (hidden while the cursor reads the chart) */
.sv-lcend{position:absolute;inset:0;pointer-events:none}
.sv-lcend i{position:absolute;right:0;width:9px;height:9px;margin:-4.5px -4.5px 0 0;border-radius:50%;background:var(--wc);border:2px solid var(--sv-teal)}
.sv-lcend em{position:absolute;right:10px;transform:translateY(-130%);font-style:normal;font-family:var(--wmono);font-size:10.5px;font-weight:600;color:var(--wt);
background:var(--wc);padding:1px 6px;border-radius:4px;border:1px solid var(--wbd2);white-space:nowrap}
.sv-lcend i.sup{border-color:var(--sv-amber)}.sv-lcend i.bon{border-color:rgba(255,176,46,.7)}.sv-lcend i.pho{border-color:var(--sv-pho)}.sv-lcend i.tpb{border-color:var(--sv-violet)}
.sv-lcend em.bon{transform:translateY(30%)}
.sv-lc.on .sv-lcend{opacity:0}
/* Economics: four readouts stay one column (the price first), so the graphs keep their width */
/* Economics: the price in the title row, a little apart from the title and its key */
.sv-tp{display:inline-flex;align-items:baseline;gap:12px;margin-left:22px;padding-left:20px;border-left:1px solid var(--wbd2);white-space:nowrap;font-variant-numeric:tabular-nums}
.sv-tp b{font-size:16px;font-weight:800;letter-spacing:-.01em;line-height:1}
.sv-tp i{font-style:normal;font-family:var(--wmono);font-size:11px;letter-spacing:.02em}
.sv-tp i.up{color:var(--sv-green)}.sv-tp i.dn{color:#ff6a3d}
.sv-tp small{font-family:var(--wmono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--wf)}
.sv-tp small u{text-decoration:none;font-size:11px;letter-spacing:.02em;color:var(--ws);margin-left:4px}
@media(max-width:620px){.sv-tp{flex:1 1 100%;flex-wrap:wrap;row-gap:4px;margin-left:0;padding-left:0;border-left:0}}
/* what the token is for, after the price: a quiet chip in the token's colour */
.sv-trole{display:inline-flex;align-items:center;height:20px;margin-left:16px;padding:0 9px;border-radius:999px;border:1px solid color-mix(in srgb,var(--c) 45%,transparent);
  background:color-mix(in srgb,var(--c) 10%,transparent);color:var(--c);font-family:var(--wmono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}
@media(max-width:620px){.sv-trole{margin-left:0}}
.sv-tmax{font-family:var(--wmono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--sv-pho);opacity:.85;white-space:nowrap}
.sv-lcur{position:absolute;top:0;bottom:0;width:1px;margin-left:-.5px;background:var(--wt);opacity:0;pointer-events:none}
.sv-lc.on .sv-lcur{opacity:.45}
.sv-lcdots{position:absolute;inset:0;pointer-events:none;display:none}
.sv-lc.on .sv-lcdots{display:block}
.sv-lcdots i{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:var(--wc);border:2px solid var(--sv-teal)}
.sv-lcdots i.sup,.sv-lctip i.sup{border-color:var(--sv-amber);background:var(--sv-amber)}.sv-lcdots i.sup{background:var(--wc)}
.sv-lcdots i.bon{border-color:rgba(255,176,46,.7)}.sv-lcdots i.pho{border-color:var(--sv-pho)}.sv-lcdots i.tpb{border-color:var(--sv-violet)}
.sv-lctip{position:absolute;top:6px;display:none;flex-direction:column;gap:2px;padding:6px 10px;margin-left:10px;border-radius:8px;border:1px solid var(--wbd2);
background:var(--wc);box-shadow:0 6px 18px rgba(0,0,0,.35);font-size:11px;color:var(--ws);white-space:nowrap;pointer-events:none;z-index:2}
.sv-lctip.flip{transform:translateX(calc(-100% - 20px))}
.sv-lc.on .sv-lctip{display:flex}
.sv-lctip b{font-family:var(--wmono);font-size:9.5px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--wf)}
.sv-lctip span{display:flex;align-items:center;gap:6px}
.sv-lctip em{font-style:normal;font-weight:700;color:var(--wt);font-variant-numeric:tabular-nums}
.sv-lctip i{width:8px;height:8px;border-radius:2px;background:var(--sv-teal)}
.sv-lctip i.bon{background:rgba(255,176,46,.55)}.sv-lctip i.pho{background:var(--sv-pho)}.sv-lctip i.tpb{background:var(--sv-violet)}
.sv-bars{position:relative}
.sv-bl2{position:absolute;left:0;right:0;height:0;border-top:1px solid var(--wbd);pointer-events:none;z-index:1}
.sv-bl2 b{position:absolute;left:0;top:0;transform:translateY(-50%);font-family:var(--wmono);font-size:9.5px;font-weight:400;line-height:14px;color:var(--ws);
background:var(--wc);padding:0 5px;border-radius:3px}
.sv-bl2:last-of-type b{transform:translateY(0)}
.sv-bars i[data-t],.sv-pace i[data-t]{cursor:crosshair}
.sv-bars i[data-t]:hover,.sv-pace i[data-t]:hover{filter:brightness(1.35)}
.sv-btip{position:absolute;top:4px;display:none;padding:4px 9px;border-radius:7px;border:1px solid var(--wbd2);background:var(--wc);box-shadow:0 6px 18px rgba(0,0,0,.35);
font-size:11px;font-weight:600;color:var(--wt);white-space:nowrap;pointer-events:none;z-index:2;transform:translateX(-50%)}
.sv-btip.on{display:block}.sv-btip.flip{transform:translateX(-100%)}.sv-btip.rt{transform:translateX(0)}
@media(max-width:900px){
  #sv-signp,#sv-prop24,#sv-act7,#sv-actlive,#sv-ecoa,#sv-ecop{flex:0 0 auto}
  html[data-svs=eco] #sv-eco{grid-template-rows:none}
  html[data-svs=net] #sv-net{grid-template-rows:none}
  #sv-ecocards{grid-template-columns:minmax(0,1fr)}
  .sv-grid,.sv-plist{max-height:60svh}
  .sv-bars{height:140px;flex:0 0 auto}
  .sv-lc{height:180px;flex:0 0 auto}
  .sv-plive{grid-template-columns:repeat(8,minmax(0,1fr))}
}
@media(max-width:620px){
  .sv-grid{grid-template-columns:120px minmax(0,1fr)}
  .sv-pb s{display:none}
  .sv-upbars,.sv-pace,.sv-bars.live{gap:1px}
  #sv-sign .sv-rt,#sv-prop .sv-rt,#sv-act .sv-rt,#sv-eco .sv-rt,#sv-pace .sv-rt{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;gap:8px}
}
/* ══ Readouts: every Network figure sits on a rail down its panel's right rim - tags cut from
   the rim, open on the rim side, rounded toward the content, their colour running along the edge.
   They share the body's height between them, so the heading stays one line and the graph gets
   what a row of boxes used to cost. ══ */
.sv-rbody{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:14px}
.sv-rmain{display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0}
/* four readouts on a short rail stand 2 x 2, so each keeps its line */
.sv-rail:has(>.sv-rd:nth-child(4)){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:352px}
.sv-rail{display:flex;flex-direction:column;gap:6px;margin-right:-17px;min-height:0;width:176px}
.sv-rd{--rc:var(--sv-teal);position:relative;flex:1 1 0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:1px;
min-width:0;min-height:0;padding:3px 18px 3px 14px;border:1px solid var(--wbd2);border-right:0;border-radius:12px 0 0 12px;overflow:hidden;
background:linear-gradient(90deg,rgba(255,255,255,.035),rgba(255,255,255,.01))}
.sv-rd::after{content:"";position:absolute;inset:0;background:linear-gradient(270deg,var(--rc),rgba(0,0,0,0) 75%);opacity:.14;pointer-events:none}
.sv-rd::before{content:"";position:absolute;right:0;top:8px;bottom:8px;width:2px;border-radius:2px 0 0 2px;background:var(--rc);box-shadow:0 0 12px var(--rc)}
.sv-rd em{font-style:normal;font-family:var(--wmono);font-size:8.5px;line-height:1.2;letter-spacing:.16em;text-transform:uppercase;color:var(--wf);white-space:nowrap}
.sv-rd b{font-size:17px;font-weight:800;letter-spacing:-.015em;line-height:1.08;color:var(--wt);font-variant-numeric:tabular-nums;white-space:nowrap}
.sv-rd small{font-size:10px;line-height:1.2;color:var(--ws);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
@media(min-width:901px) and (max-height:820px){.sv-rd{gap:0;padding-top:2px;padding-bottom:2px}.sv-rd b{font-size:14px;line-height:1.1}.sv-rd small{font-size:9px}.sv-rd em{font-size:8px}.sv-rail{gap:4px;margin-right:-15px}}
/* Economics stacks three readouts on each rail under two price cards, so its rails are shorter:
   the compact readout from a taller screen down, so every bottom line (the 30-day change) shows */
@media(max-width:900px){
  .sv-rbody{grid-template-columns:minmax(0,1fr);row-gap:10px}
  .sv-rail{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-right:0;width:auto}
  #sv-netcards .sv-span:last-child:nth-child(odd){grid-column:1/-1}
  .sv-rd{border-right:1px solid var(--wbd2);border-radius:10px;min-width:0;padding:7px 10px}
  .sv-rd::before{right:auto;left:10px;top:auto;bottom:0;width:auto;right:10px;height:2px;border-radius:2px 2px 0 0}
  .sv-rd small{white-space:normal}
}
/* the span cards: centred, the figure over a strip of the set */
.sv-span{align-items:center;text-align:center;gap:6px}
#sv-netcards .sv-span .sv-k{display:flex;align-items:center;gap:10px;width:100%;justify-content:center}
#sv-netcards .sv-span .sv-k::before,#sv-netcards .sv-span .sv-k::after{content:"";flex:0 1 38px;height:1px;background:linear-gradient(90deg,transparent,var(--wbd2))}
#sv-netcards .sv-span .sv-k::after{background:linear-gradient(90deg,var(--wbd2),transparent)}
.sv-span .sv-big{font-size:30px;margin:0}
.sv-cells{display:grid;grid-template-columns:repeat(100,minmax(0,1fr));gap:1px;width:min(100%,420px);height:7px}
.sv-cells i{border-radius:1px;background:color-mix(in srgb,var(--sv-teal) 75%,transparent)}
.sv-cells i.j{background:var(--sv-amber)}
.sv-cells i.u{background:var(--wbd2)}
.sv-span .sv-sub{font-size:12px}
/* ══ Wallet and Autopilot: one frame. A readout strip lit from its top edge (who, then five
   figures, each in its own colour along the top rim and standing on a meter of its share),
   then three columns: figures hanging from the left rim, the skyline, a flat list. ══ */
html[data-svs=over] #sv-over,html[data-svs=auto] #sv-auto,html[data-svs=mygov] #sv-mygov{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);gap:12px}
.sd-scr>*,.sd-scr>*:not(:first-child){margin-top:0}
/* the left column a little wider than it was (.95 / 1.55), so Move your stake's title, its +APR pill and
   "N moves, 1 signature" share one line; the middle panel has room to give */
.sd-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1.35fr) minmax(0,1fr);gap:12px;min-height:0}
/* the Wallet: Your delegations on the left, Move your stake on the right - the wider column goes with it */
.sd-wgrid{grid-template-columns:minmax(0,1fr) minmax(0,1.35fr) minmax(0,1.15fr)}
/* the left column exactly the wallet box's width above it: 1.6 of the strip's 6.6 parts */
@media(min-width:901px){.sd-wgrid{grid-template-columns:max(calc((100% - 2px) * 0.242424 + 2px),250px) minmax(0,1.35fr) minmax(0,1.15fr)}}
/* Autopilot stands as the Overview: its first column the lead card's width above it */
@media(min-width:901px){.sd-agrid{grid-template-columns:max(calc((100% - 2px) * 0.242424 + 2px),250px) minmax(0,1.35fr) minmax(0,1.15fr)}}
/* Autopilot's lead card: the wallet card's build, in Autopilot's own teal-to-violet, its orbits turning */
.sd-ida{position:relative;overflow:hidden;color:#fff;justify-content:center;
background:radial-gradient(circle at 104% 118%,transparent 0 44px,rgba(255,255,255,.13) 45px 46px,transparent 47px 70px,rgba(255,255,255,.09) 71px 72px,transparent 73px 98px,rgba(255,255,255,.06) 99px 100px,transparent 101px 128px,rgba(255,255,255,.035) 129px 130px,transparent 131px),
radial-gradient(130% 100% at 0% 0%,rgba(143,245,236,.3),transparent 58%),linear-gradient(140deg,#0f6b67 0%,#1f3f79 55%,#1a1146 100%)}
.sd-ida::after{content:"";position:absolute;right:22px;bottom:18px;width:7px;height:7px;border-radius:50%;background:#dffcf9;box-shadow:0 0 12px 2px rgba(143,245,236,.9)}
.sd-ida h3{color:#fff}
/* the lead card as the wallet card: name and state on one line, the door compact under them */
.sd-strip .sd-ida{justify-content:flex-start;gap:9px}
.sd-ida .sd-top{justify-content:flex-start;gap:10px}
/* its state and its door as the wallet card's chips: the same size, the same place under the name */
.sd-ida .sd-wch i.st{color:#dffcf9;border-color:rgba(255,255,255,.35);background:rgba(255,255,255,.1)}
.sd-ida .sd-wch i.st.on{color:#8ff0b0;border-color:rgba(143,240,176,.55);background:rgba(46,224,106,.16)}
.sd-ida .sd-wch button{font:inherit;font-family:var(--wmono);font-size:8.5px;line-height:1;letter-spacing:.14em;text-transform:uppercase;padding:3px 7px;border-radius:999px;cursor:pointer;
  color:#1b1440;border:1px solid #d6d0ff;background:#d6d0ff}
.sd-ida .sd-wch button:hover{background:#fff;border-color:#fff}
.sd-ida .sd-wch button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.sd-ida .sv-tag{color:#dffcf9;border-color:rgba(255,255,255,.35);background:rgba(255,255,255,.1)}
.sd-ida .sv-tag.g{color:#8ff0b0;border-color:rgba(143,240,176,.55);background:rgba(46,224,106,.16)}
.sd-col{background:linear-gradient(180deg,#131329,#0c0c1a);border:1px solid var(--wbd2);border-radius:12px;box-shadow:inset 0 1px 0 #ffffff08;
position:relative;padding:14px 16px;gap:10px;min-height:0;display:flex;flex-direction:column}
.sd-col::before{content:"";position:absolute;left:16px;right:16px;top:0;height:1px;background:linear-gradient(90deg,transparent,var(--tc,#6f66c8),transparent);opacity:.95;pointer-events:none}
#sd-move,#sd-ado{--tc:var(--sv-green)}#sd-sky,#sd-asky{--tc:var(--sv-amber)}#sd-list,#sd-alist{--tc:var(--sv-teal)}#sd-ado{--tc:var(--sv-violet)}
/* the strip */
.sd-strip{display:grid !important;grid-template-columns:minmax(0,1.2fr) repeat(5,minmax(0,1fr));padding:0 !important;gap:0 !important;overflow:hidden}
.sd-id{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:7px;padding:14px 18px;min-width:0}
.sd-id h3{margin:0;font-size:18px;font-weight:700;letter-spacing:-.01em;color:var(--wt);max-width:100%}
/* the Wallet's box: the name and the read time with its refresh on one row, the time at the right end */
.sd-idw{justify-content:flex-start;align-items:stretch}
/* the wallet card: who (name, app, network) */
.sd-strip .sd-idw{flex-direction:row;align-items:stretch;justify-content:space-between;gap:12px}
.sd-idl{display:flex;flex-direction:column;gap:9px;min-width:0}
/* the wallet card: the one hard colour of the strip, the same in day and night */
.sd-idw{position:relative;overflow:hidden;color:#fff;
background:radial-gradient(120% 130% at 0% 0%,rgba(1,215,235,.42),transparent 55%),radial-gradient(80% 110% at 100% 115%,rgba(1,215,235,.16),transparent 60%),
linear-gradient(150deg,#02358a 0%,#00205f 45%,#001347 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 0 0 1px rgba(255,255,255,.06)}
/* the wallet card: PHOTON's colours - its deep navy lit by its cyan from the top left, faintly from the foot, ribbons of light sweeping across it, a few
   faint stars */
.sd-idw::before{content:"";position:absolute;inset:0;pointer-events:none;background:url(assets/silk.svg) center/100% 100% no-repeat}
.sd-idw::after{display:none}
.sd-idw>*{position:relative;z-index:1}
.sd-idw h3,.sd-idw .sv-wn{color:#fff}
.sd-idw .sd-wch i.app{color:#e4dfff;border-color:rgba(255,255,255,.32);background:rgba(255,255,255,.1)}
.sd-idw .sd-wch i.net{color:#8ff5ec;border-color:rgba(143,245,236,.45);background:rgba(43,200,189,.14)}
.sd-idw .sd-wch i.net.tn{color:#ffd58a;border-color:rgba(255,213,138,.5);background:rgba(255,176,46,.14)}
.sd-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 10px;width:100%;min-width:0}
.sd-top h3{flex:1 1 auto;min-width:min(100%,108px);overflow:hidden}
/* wide enough: the first box takes a little more, so the name and the read time share one row */
@media(min-width:901px){.sd-strip{grid-template-columns:minmax(0,1.6fr) repeat(5,minmax(0,1fr)) !important}}
/* the wallet box's second and third lines: address + copy, then the wallet app and the network */
.sd-wmeta{display:flex;flex-direction:column;align-items:flex-start;gap:5px;margin-top:-2px;min-width:0;width:100%}
.sd-wch{display:flex;gap:6px;flex-wrap:wrap}
.sd-wch i{font-style:normal;font-family:var(--wmono);font-size:8.5px;line-height:1;letter-spacing:.14em;text-transform:uppercase;padding:3px 7px;border-radius:999px;border:1px solid}
.sd-wch i.app{color:var(--sv-violet);border-color:rgba(185,176,255,.4);background:rgba(185,176,255,.08)}
.sd-wch i.net{color:var(--sv-teal);border-color:rgba(43,200,189,.4);background:rgba(43,200,189,.08)}
.sd-wch i.net.tn{color:var(--sv-amber);border-color:rgba(255,176,46,.4);background:rgba(255,176,46,.08)}
.sd-wnone{font-size:12px;color:var(--wf)}
.sd-wbtn{height:30px;padding:0 14px;border-radius:8px;border:1px solid rgba(255,176,46,.55);background:linear-gradient(180deg,rgba(255,176,46,.22),rgba(255,176,46,.1));color:#ffc453;font:600 12px var(--wsans);cursor:pointer}
.sd-wbtn:hover{border-color:#ffb02e;color:#ffd58a}
.sd-wbtn:focus-visible{outline:2px solid #ffb02e;outline-offset:2px}
.sd-ro{--rc:var(--sv-teal);position:relative;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:14px 18px 13px;min-width:0;border-left:1px solid var(--wbd)}
/* each box's colour is a small key before its label, as the graphs' legends are */
.sd-ro em::before{content:"";display:inline-block;width:6px;height:6px;margin-right:7px;border-radius:2px;vertical-align:1px;background:var(--rc);box-shadow:0 0 8px var(--rc)}
.sd-ro em{font-style:normal;font-family:var(--wmono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf);white-space:nowrap}
/* each figure sits in an engraved well: a recess in the box, lit faintly by the box's own colour at
   its left, so the eye lands on the number (Overview, Manage and Autopilot strips alike) */
.sd-well{display:flex;align-items:center;min-width:0;margin:5px 0 4px;padding:5px 11px 6px;border-radius:9px;border:1px solid rgba(0,0,0,.45);
background:radial-gradient(120% 160% at 0% 50%,color-mix(in srgb,var(--rc) 13%,transparent),transparent 62%),linear-gradient(180deg,rgba(0,0,0,.42),rgba(0,0,0,.2));
box-shadow:inset 0 2px 6px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,255,255,.05),0 1px 0 rgba(255,255,255,.05)}
.sd-well>b{font-size:21px;font-weight:800;letter-spacing:-.02em;line-height:1.15;color:var(--wt);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.sd-ro small{font-size:11px;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sd-ro small b{font-size:inherit;font-weight:700}
.sd-m{display:block;position:relative;height:4px;border-radius:2px;background:var(--wbd);margin-top:9px}
.sd-m s{display:block;height:100%;border-radius:2px;background:var(--rc);box-shadow:0 0 8px var(--rc)}
.sd-m.mix{display:flex;gap:2px;background:none}
.sd-m.mix s{min-width:2px;box-shadow:none}
.sd-m.apr u{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--wc);border:2px solid var(--wt);box-shadow:0 0 8px rgba(255,255,255,.4)}
/* the strip, 2026-09-27 evening: no captions; the well fills the box under its label, the unit beside the
   figure, a second compartment where one belongs (PHOTON, the validator count), the gauge set into the
   well's floor, the APR's range written at its ends */
.sd-strip .sd-ro{justify-content:flex-start;gap:0;padding:12px 14px 12px}
.sd-strip .sd-ro em{margin-bottom:7px}
.sd-strip .sd-well{position:relative;flex:1 1 auto;align-items:center;gap:6px;margin:0;padding:6px 12px 6px;min-height:46px;box-sizing:border-box}
.sd-strip .sd-well.mtr{padding-bottom:14px}
.sd-strip .sd-well>b{font-size:22px}
.sd-well>i.u{flex:0 0 auto;align-self:center;margin-top:6px;font-style:normal;font-family:var(--wmono);font-size:8.5px;letter-spacing:.14em;color:var(--wf);padding-bottom:0}
.sd-wx{flex:0 1 auto;min-width:0;margin-left:auto;padding-left:10px;border-left:1px solid rgba(255,255,255,.09);display:flex;flex-direction:column;align-items:flex-end;
font-family:var(--wmono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--wf);white-space:nowrap}
.sd-wx b{font-family:var(--wsans);font-size:14px;font-weight:700;letter-spacing:-.01em;text-transform:none;color:var(--ws);font-variant-numeric:tabular-nums}
.sd-wx.pho b{color:var(--sv-pho)}
.sd-strip .sd-well>b{flex:0 0 auto}
.sd-strip .sd-well>i.u{min-width:0;overflow:hidden}
.sd-strip .sd-well>.sd-m{position:absolute;left:12px;right:12px;bottom:6px;margin:0;height:3px;background:rgba(255,255,255,.06)}
.sd-strip .sd-well>.sd-m.apr{bottom:7px;height:3px}
.sd-strip .sd-well>.sd-m.apr u{width:9px;height:9px;margin:-4.5px 0 0 -4.5px}
/* figures hanging from the left rim: open on the rim side, the value's colour along it */
.sd-figs{display:flex;flex-direction:column;gap:8px;flex:1 1 auto;min-height:0}
.sd-fig{--rc:var(--sv-teal);position:relative;flex:1 1 0;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:1px;margin-left:-17px;
padding:2px 14px 2px 20px;border:1px solid var(--wbd2);border-left:0;border-radius:0 12px 12px 0;overflow:hidden;background:linear-gradient(90deg,rgba(255,255,255,.035),rgba(255,255,255,.008))}
.sd-fig::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:2px;border-radius:0 2px 2px 0;background:var(--rc);box-shadow:0 0 12px var(--rc)}
.sd-fig::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--rc),rgba(0,0,0,0) 70%);opacity:.1;pointer-events:none}
.sd-fig em{font-style:normal;font-family:var(--wmono);font-size:9px;line-height:1.3;letter-spacing:.16em;text-transform:uppercase;color:var(--wf)}
.sd-fig>b{display:flex;align-items:baseline;gap:7px;font-size:25px;font-weight:800;letter-spacing:-.02em;line-height:1.05;color:var(--wt);font-variant-numeric:tabular-nums;white-space:nowrap}
.sd-fig>b .u{font-style:normal;font-family:var(--wmono);font-size:10px;font-weight:400;letter-spacing:.14em;color:var(--wf)}
.sd-fig small{font-size:11px;line-height:1.2;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sd-col>.sd-fig{flex:0 0 auto;padding-top:9px;padding-bottom:9px}
/* the active Autopilot's two gains, side by side under the sentence */
.sd-figs.two{flex-direction:row;flex:0 0 auto;gap:8px}
.sd-figs.two .sd-fig{flex:1 1 0;margin-left:0;padding:8px 12px 9px 14px;border-left:1px solid var(--wbd2);border-radius:10px}
.sd-figs.two .sd-fig::before{top:10px;bottom:10px}
.sd-figs.two .sd-fig>b{font-size:21px}
.sd-figs.two .sd-fig em{font-size:8.5px;letter-spacing:.12em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sd-gain{color:var(--sv-green)}
.sd-ok{font-size:13px;line-height:1.45;color:var(--wt);padding:8px 12px;border-radius:8px;border:1px solid rgba(46,224,106,.35);background:rgba(46,224,106,.07)}
.sd-ok b{color:var(--sv-green);font-weight:700}
.sd-ok b.d{color:var(--wt)}
.sd-rs{font-size:12px;line-height:1.45;color:var(--ws);padding-left:10px;border-left:2px solid var(--sv-violet)}
.sd-rs b{color:var(--wt)}
.sd-go{width:100%;height:40px;flex:0 0 auto;justify-content:center}
/* Overview's three panels line up as Manage's do: one title-row height, the content starting on one line;
   What your stake earns stands at the top - the year card, its three boxes 8px under it, as Move your
   stake's cards - its doors at the foot */
:is(#sv-over,#sv-auto) .sd-col>.sv-ph{min-height:27px}
#sv-over .se-mid,#sv-over .se-ex{flex:0 0 auto;gap:8px}
#sv-over .se-mid>.se-hero,#sv-over .se-ex>.se-hero{flex:0 0 auto}
#sv-over .se-mid::after,#sv-over .se-ex::after{display:none}
#sv-over .se-row{margin-top:0}
/* the restake card: one wide figure under the three boxes, in teal */
/* the restake offer: set apart below the plain year (the room left, at least 14px) - a line naming it, then
   Now and Restaking side by side as Move your stake shows its cards; the door under it */
#sv-over .se-mid,#sv-over .se-ex{flex:1 1 auto}
/* What your stake earns: the year card and its three boxes centred; the boxes taller */
#sd-sky .se-card,#sd-rs .se-card{align-items:center;text-align:center}
/* the restake card: the year card's build, in teal */
.se-card.se-rc2::before{background:var(--sv-teal);box-shadow:0 0 12px var(--sv-teal)}
.se-rc2 em{font-style:normal;font-family:var(--wmono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf)}
@media(min-width:901px) and (max-height:640px){.se-rc2 small{display:none}}
.se-rc2{background:linear-gradient(90deg,rgba(43,200,189,.1),rgba(255,255,255,.012) 70%)}
.se-rc2 small{font-size:12px;color:var(--ws)}
#sd-sky .se-card>b,#sd-rs .se-card>b{justify-content:center}
#sv-over #sd-sky .se-row .sd-fig{align-items:center;text-align:center;padding-top:16px;padding-bottom:17px;gap:5px}
#sd-sky .se-row .sd-fig>b{justify-content:center}
/* the restake offer's head: a title and its tag, the APR it adds under it */
/* the APR restaking adds, in a teal band under the title */
.se-rss{padding:10px 13px;border-radius:10px;border:1px solid rgba(43,200,189,.4);background:linear-gradient(90deg,rgba(43,200,189,.16),rgba(43,200,189,.05));font-size:12px;color:var(--wt)}
.se-rss b{color:var(--sv-teal);font-weight:700}
@media(min-width:901px) and (max-height:1000px){#sv-over #sd-sky .se-row .sd-fig{padding-top:17px;padding-bottom:18px}}
@media(min-width:901px) and (max-height:760px){#sv-over #sd-sky .se-row .sd-fig{padding-top:8px;padding-bottom:9px}.se-rss{padding:6px 11px;font-size:11px}}
/* restaking: the day, week and month keep the line saying what restake adds */
#sv-over .se-row.rson .sd-fig small{display:block}
.se-rsv{color:var(--sv-teal)}
.se-rsm{color:var(--sv-green);font-weight:700}
.se-rson{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:0 0 auto;padding:10px 12px;border-radius:10px;border:1px solid rgba(43,200,189,.4);
background:rgba(43,200,189,.08);font-size:12px;color:var(--wt)}
.se-rsch{height:24px;padding:0 10px;border-radius:6px;border:1px solid rgba(43,200,189,.55);background:transparent;color:#6fe3da;font:600 11px var(--wsans);cursor:pointer}
@media(min-width:901px) and (max-height:1000px){#sv-over .se-card{padding-top:8px;padding-bottom:9px}#sv-over .se-card>b{font-size:30px}
  #sv-over .se-mid,#sv-over .se-ex{gap:6px}#sv-over .se-row .sd-fig small{display:none}#sv-over .se-row .sd-fig{padding-top:5px;padding-bottom:6px}}
@media(min-width:901px) and (max-height:700px){}
@media(min-width:901px) and (max-height:640px){#sv-over .se-card>b{font-size:24px}
  #sv-over .se-row .sd-fig>b{font-size:14px}#sv-over .se-mid,#sv-over .se-ex{gap:4px}}
/* the doors never sit on the content: the content gives way above them */
#sv-over #sd-sky .se-mid,#sv-over #sd-sky .se-ex{min-height:min-content}
/* a short window has no room for it under the boxes: the doors must stand in the panel */
/* short windows keep the restake card: one line, the doors and the boxes a touch tighter */
@media(min-width:901px) and (max-height:760px){
  }
/* shorter still: the year card and its boxes compact, so both doors stand inside the panel */
@media(min-width:901px) and (max-height:700px){
  #sv-over .se-card{padding:8px 14px 9px}#sv-over .se-card>b{font-size:30px}
  #sv-over .se-row .sd-fig{padding-top:5px;padding-bottom:6px}#sv-over .se-row .sd-fig>b{font-size:17px}
  #sv-over #sd-sky .sd-go,#sv-over #sd-move .sd-go{height:34px}}
@media(min-width:901px) and (max-height:700px){#sv-over .se-row .sd-fig small{display:none}#sv-over .se-mid,#sv-over .se-ex{gap:6px}}
@media(min-width:901px) and (max-height:640px){#sv-over .se-card small.se-apr{display:none}#sv-over .se-card em{display:none}#sv-over .se-row .sd-fig>b{font-size:15px}#sv-over .se-row .sd-fig{padding-top:3px;padding-bottom:3px}}
@media(min-width:901px) and (max-height:640px){
  #sv-over .se-card{padding:6px 14px 7px;gap:0}#sv-over .se-card>b{font-size:26px}#sv-over .se-card em{font-size:8px}
  #sv-over .se-mid,#sv-over .se-ex{gap:6px}#sv-over .se-row .sd-fig{padding-top:4px;padding-bottom:4px}
  :is(#sv-over,#sv-auto) .sd-col>.sv-ph{min-height:24px}}
/* the restake offer stands at the panel's foot, level with Where your stake sits' three boxes and built as they
   are (8px label, 18px figure, 10px line, the same padding and radius), in green */
#sv-over #sd-rs .se-card.se-rc2{position:relative;gap:1px;padding:7px 14px 8px;border-radius:9px;background:linear-gradient(0deg,rgba(46,224,106,.1),rgba(255,255,255,.012) 70%)}
#sv-over #sd-rs .se-card.se-rc2::before{background:var(--sv-green);box-shadow:0 0 12px var(--sv-green)}
#sv-over #sd-rs .se-rc2 em{display:block;font-size:8px;letter-spacing:.1em;line-height:1.5}
#sv-over #sd-rs .se-rc2>b{font-size:18px;line-height:1.5;font-weight:800;letter-spacing:-.02em}
#sv-over #sd-rs .se-rc2>b :is(span,i){line-height:1.5}#sv-over #sd-rs .se-rc2>b i{font-size:10px}
#sv-over #sd-rs .se-rc2 small{display:block;font-size:9px;line-height:1.5;color:var(--ws);white-space:nowrap}
#sv-over #sd-rs .se-rc2 .se-rsv{color:var(--sv-green)}
@media(min-width:901px) and (max-height:700px){#sv-over #sd-rs .se-rc2>b{font-size:15px}}
/* a short window: the day, week and month each on one line (label beside the figure), so the restake card still
   stands level with the boxes */
@media(min-width:901px) and (max-height:640px){#sv-over #sd-sky .se-row .sd-fig{flex-direction:row;align-items:baseline;justify-content:center;gap:8px;padding-top:3px;padding-bottom:3px}
  #sv-over #sd-sky .se-row .sd-fig>em{margin:0}#sv-over #sd-sky .se-row .sd-fig::before{display:none}#sv-over #sd-sky .se-mid,#sv-over #sd-sky .se-ex{gap:4px}}
/* phones: a band stays one line */
@media(max-width:900px){:is(#sv-over,#sv-auto) .sd-col>.sv-ph{flex-wrap:nowrap}:is(#sv-over,#sv-auto) .sd-col>.sv-ph h3{min-width:0;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  :is(#sv-over,#sv-auto) .sd-col>.sv-ph .sv-tag{flex:0 0 auto}
  #sv-over #sd-rs .se-card.se-rc2{padding:8px 12px 10px}}
/* a short window: the day, week and month one line each, the year one line under them */
@media(min-width:901px) and (max-height:640px){
  #sv-over #sd-sky :is(.se-mid,.se-ex){gap:4px}
  #sv-over #sd-sky .se-hero{padding:0;min-width:0}
  #sv-over #sd-sky .se-hero>.se-card:not(#z){height:100%;box-sizing:border-box;flex-direction:row;align-items:baseline;justify-content:center;gap:6px;padding:3px 8px}
  #sv-over #sd-sky .se-hero>.se-card>em:not(#z){display:block;margin:0;font-size:8px}
  #sv-over #sd-sky .se-hero>.se-card>b{font-size:15px}#sv-over #sd-sky .se-hero>.se-card>b>i{font-size:8px}
  #sv-over #sd-sky .se-hero>.se-card>small{display:none}#sv-over #sd-sky .se-hero>.se-card::before{display:none}
  #sv-over #sd-sky .se-row{gap:4px}#sv-over #sd-sky .se-row .sd-fig:not(#z){margin-left:0;padding:3px 6px;gap:5px;border-left:1px solid var(--wbd2);border-radius:9px;min-width:0}
  #sv-over #sd-sky .se-row .sd-fig>em{letter-spacing:.04em;white-space:nowrap;overflow:visible}#sv-over #sd-sky .se-row .sd-fig>b{white-space:nowrap}}
/* shorter still: every band a step lower, so both middle panels keep their content */
@media(min-width:901px) and (max-height:560px){:is(#sv-over,#sv-auto) .sd-col>.sv-ph:not(#z){min-height:34px!important;padding-top:1px!important;padding-bottom:2px!important}}
/* What your stake earns: Move your stake's four big boxes, in amber; the year's box carries restake's line in green */
#sv-over #sd-sky .se-earn{flex:1 1 auto;min-height:0}
/* the row under the earnings: Stake more and Claim rewards, as tall as Redelegate and on its line */
#sv-over #sd-sky .se-cl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;flex:0 0 auto}
#sv-over #sd-sky .se-cl .sd-go{width:100%;margin-top:0}
#sv-over #sd-sky .se-cl.one{grid-template-columns:minmax(0,1fr)}

/* its figures a step under Move's, so a five-figure year fits its box */
#sv-over #sd-sky .se-earn .sd-fig>b:not(#z){font-size:34px;white-space:nowrap}
@media(min-width:901px) and (max-height:700px){#sv-over #sd-sky .se-earn .sd-fig>b:not(#z){font-size:26px}}
@media(min-width:901px) and (max-height:640px){#sv-over #sd-sky .se-earn .sd-fig>b:not(#z){font-size:21px}}
#sd-sky .se-amt{color:var(--sv-amber)}
#sd-sky .se-earn .sd-fig{position:relative}
@media(min-width:901px) and (min-height:821px) and (max-height:1000px){#sv-over #sd-sky .se-earn .sd-fig>b:not(#z){font-size:30px}}
@media(min-width:901px) and (max-height:640px){#sv-over #sd-sky .se-earn .sd-fig>b:not(#z){font-size:19px}#sv-over #sd-sky .se-earn .sd-fig em:not(#z){padding-bottom:3px;margin-bottom:0}}
/* Autopilot's panels: bands of their own - What it does cyan, What it doesn't crimson, Validators slate */
#sv-auto #sd-ado{--bandf:#0d6d7a,#0f3f55 58%,#101830}
#sv-auto #sd-ado>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.12),transparent 60%),linear-gradient(315deg,#0d6d7a,#0f3f55 58%,#101830)}
#sv-auto #sd-asky{--bandf:#7a1f2b,#44141d 58%,#1a0f1c}
#sv-auto #sd-asky>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.12),transparent 60%),linear-gradient(315deg,#7a1f2b,#44141d 58%,#1a0f1c)}
#sv-auto #sd-alist{--bandf:#3d4a66,#262f45 58%,#141827}
#sv-auto #sd-alist>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.12),transparent 60%),linear-gradient(315deg,#3d4a66,#262f45 58%,#141827)}
#sv-auto #sd-ado{--tc:#2bc8d6}#sv-auto #sd-asky{--tc:#ff6a6a}#sv-auto #sd-alist{--tc:#8f9cc4}
/* the four boxes fill each panel, as in What your stake earns */
#sv-auto .ap-mv{flex:1 1 auto;min-height:0}
@media(min-width:901px){#sv-auto .sd-agrid:not(#z){grid-template-columns:minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1fr)}}
#sv-auto .ap-mv .sd-fig>b:not(#z){font-size:32px;white-space:nowrap}
#sv-auto .ap-mv .sd-fig small{white-space:normal;text-wrap:balance;line-height:1.35}
#sv-auto .ap-mv .ap-no{color:#ff8a8a}#sv-auto .ap-mv .ap-ok{color:var(--sv-green)}
#sv-auto .ap-mv .sd-fig>b em.u{font-style:normal;font-family:var(--wmono);font-size:10px;letter-spacing:.12em;color:var(--wf);margin-left:6px}
@media(min-width:901px) and (max-height:700px){#sv-auto .ap-mv .sd-fig>b:not(#z){font-size:24px}#sv-auto .ap-mv .sd-fig small{font-size:10px}}
@media(min-width:901px) and (max-height:600px){#sv-auto .ap-mv .sd-fig>b:not(#z){font-size:19px}#sv-auto .ap-mv .sd-fig small{display:none}}
/* Validators, before Autopilot is on: the way to switch it on, centred */
#sv-auto .ap-act{flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:10px 12px}
#sv-auto .ap-act b{font-size:20px;font-weight:800;color:var(--wt)}
#sv-auto .ap-act span{max-width:30ch;font-size:12.5px;line-height:1.5;color:var(--ws);text-wrap:balance}
#sv-auto .ap-act .ap-go:not(#z){width:auto;min-width:200px;margin-top:6px;padding:0 22px}
/* the strip is one surface in Outcome's violet band fill; the wallet card and the five boxes sit on it (Easy and
   Pro alike); the figures in plain boxes, not engraved */

/* Easy and Pro: the strip as the panels under it, a touch more lit - a faint violet glow from the wallet's corner, a cool one
   from the far end */
:is(#sd-wstrip,#p-dele #sd-mstrip,#sd-gstrip).sd-strip:not(#z){border-color:#3a3a66;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 24px -12px rgba(185,176,255,.35);
background:radial-gradient(55% 160% at 0% 0%,rgba(185,176,255,.14),transparent 60%),radial-gradient(45% 140% at 100% 110%,rgba(43,200,189,.07),transparent 60%),linear-gradient(180deg,#15152e,#0d0d1c)}
:is(#sd-wstrip,#sd-mstrip,#sd-gstrip) .sd-idw:not(#z){background:none;box-shadow:none}
:is(#sd-wstrip,#sd-mstrip,#sd-gstrip) .sd-idw::before{display:none}
:is(#sd-wstrip,#sd-mstrip,#sd-gstrip) .sd-ro:not(#z){background:none;border-left-color:rgba(255,255,255,.1)}
:is(#sd-wstrip,#sd-mstrip,#sd-gstrip) .sd-ro em:not(#z){color:rgba(255,255,255,.78)}
.sd-strip .sd-ro .sd-well:not(#z){border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);box-shadow:none}
/* Govern: becoming a governor. The door sits at the right of the Governors head; the form is a txcard of its own */
.sv-ph .gr-open{margin-left:auto;flex:0 0 auto}
.gr-open .gr-sm{display:none}
@media(max-width:900px){.gr-open .gr-lg{display:none}.gr-open .gr-sm{display:inline}}
#grpop .grcard{width:min(520px,calc(100vw - 32px));max-height:92svh;overflow:auto}
.grcard .gr-who{display:flex;flex-direction:column;gap:3px;padding:14px 22px 0}
.grcard .gr-who em,.grcard .gr-k,.grcard .gr-need em{font:normal 600 8.5px var(--wmono);letter-spacing:.16em;text-transform:uppercase;color:var(--wf)}
.grcard .gr-who b{font:500 12px var(--wmono);color:var(--ws);overflow-wrap:anywhere}
.grcard .gr-f{display:flex;flex-direction:column;gap:11px;padding:14px 22px 4px}
.grcard .gr-l{display:flex;flex-direction:column;gap:5px}
.grcard .gr-k{display:flex;align-items:baseline;gap:8px}
.grcard .gr-k i{font-style:normal;color:#b9b0ff;letter-spacing:.12em}
.grcard .gr-k small{margin-left:auto;font-size:8.5px;letter-spacing:.08em;color:var(--wf)}
.grcard .gr-in{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:6px;border:1px solid var(--wbd2);background:linear-gradient(180deg,#0b0b18,#0e0e1d);
  color:var(--wt);font:13px var(--wsans);outline:none;resize:vertical;transition:border-color .15s,box-shadow .15s}
.grcard textarea.gr-in{min-height:64px;line-height:1.45}
.grcard .gr-in::placeholder{color:var(--wf);opacity:.75}
.grcard .gr-in:focus{border-color:#b9b0ff;box-shadow:0 0 0 3px rgba(185,176,255,.13)}
.grcard .gr-in.bad,.grcard .gr-in.bad:focus{border-color:var(--wburn);background:rgba(255,77,31,.1);box-shadow:0 0 0 3px rgba(255,77,31,.2)}
.grcard .gr-need{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px 22px 0}
.grcard .gr-need>div{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border-radius:8px;border:1px solid var(--wbd2);background:var(--wh);text-align:center}
.grcard .gr-need b{font:700 18px var(--wsans);color:var(--wt)}
.grcard .gr-need small{font-size:10.5px;color:var(--wf)}
.grcard .gr-need>div.ok{border-color:rgba(46,224,106,.45)}.grcard .gr-need>div.ok b{color:var(--wgreen)}
.grcard .gr-need>div.no{border-color:rgba(255,122,87,.5)}.grcard .gr-need>div.no b{color:#ff9b7a}
.grcard .gr-note{margin:12px 22px 0;font-size:11.5px;line-height:1.5;color:var(--ws)}
.grcard .txbtns{padding:16px 22px 20px}
/* Outcome's content starts on Delegations' and Redelegate's line */
@media(min-width:901px){#p-dele #wbody #wk-mv>.wk-ph+*{margin-top:10px!important}}
/* ════ Easy, one dashboard: the three panels are one surface - no borders, frames or coloured bands between them;
   every title the same plain type with one quiet bar, every title tag the same neutral pill; what sits inside keeps its
   colours ════ */
/* phones: restake's line wraps in the narrow year box instead of being cut */
@media(min-width:901px){html #sv-over .sd-wgrid.sd-wgrid:not(#z){grid-template-columns:max(calc((100% - 2px) * 0.262 + 2px),280px) minmax(0,1.35fr) minmax(0,1.15fr)!important}}
html #sv-over .sd-wgrid:not(#z){gap:0;background:linear-gradient(180deg,#131329,#0c0c1a);border:1px solid var(--wbd2);border-radius:14px;box-shadow:inset 0 1px 0 #ffffff08;overflow:hidden}
html #sv-over .sd-wgrid>.sd-col:not(#z){background:none!important;border:0!important;border-radius:0!important;box-shadow:none!important}
html :is(#sv-over #sd-list,#sv-over #sd-sky,#sv-over #sd-move)::before,html :is(#sv-over #sd-list,#sv-over #sd-sky,#sv-over #sd-move)::after{display:none!important}
html #sv-over .sd-wgrid>.sd-col>.sv-ph:not(#z){background:none!important;border-bottom:0!important;border-radius:0!important}
html #sv-over .sd-wgrid>.sd-col>.sv-ph h3:not(#z):not(#y){color:#f3f0ff!important;font-size:18px!important;font-weight:700;letter-spacing:-.012em;gap:8px}
@media(min-width:901px) and (max-width:1599px){html #sv-over .sd-wgrid>.sd-col>.sv-ph h3:not(#z):not(#y){font-size:16px!important}}
@media(min-width:901px) and (max-width:1299px){html #sv-over .sd-wgrid>.sd-col>.sv-ph h3:not(#z):not(#y){font-size:14.5px!important}}
@media(max-width:900px){html #sv-over .sd-wgrid>.sd-col>.sv-ph h3:not(#z):not(#y){font-size:15px!important}}
/* narrower windows and phones: the tile, the gaps and the tags a step tighter, so every title stays whole */
@media(max-width:1399px){html #sv-over .sd-wgrid>.sd-col>.sv-ph:not(#z){gap:6px}html #sv-over .sd-wgrid>.sd-col>.sv-ph h3:not(#z):not(#y){gap:7px}
  html #sv-over .sd-wgrid>.sd-col>.sv-ph h3::before{width:22px!important;height:22px!important;flex-basis:22px;background-size:13px 13px!important}
  html #sv-over .sd-wgrid>.sd-col>.sv-ph .sv-tag:not(#z){padding-left:5px;padding-right:5px;letter-spacing:0}}
@media(max-width:900px){html #sv-over .sd-wgrid>.sd-col>.sv-ph h3:not(#z):not(#y){font-size:14px!important}}
@media(max-width:900px){html #sv-over #sd-move .sd-mvh .sv-tag.sd-mvn:not(#z){flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
/* each title led by its own small icon tile, one soft violet for all three; the words in a gentle white-to-lavender */
html #sv-over .sd-wgrid>.sd-col>.sv-ph h3::before{width:24px!important;height:24px!important;flex:0 0 24px;border-radius:7px!important;box-sizing:border-box;
  border:1px solid rgba(185,176,255,.32);background-color:rgba(185,176,255,.12)!important;background-position:center!important;background-size:14px 14px!important;background-repeat:no-repeat!important;
  box-shadow:0 0 14px -6px rgba(185,176,255,.7)!important;opacity:1}
html #sv-over .sd-wgrid>#sd-list>.sv-ph h3::before{background-image:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23d6d0ff%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%2020V11M12%2020V4M19%2020v-6%22/%3E%3C/svg%3E")!important}
html #sv-over .sd-wgrid>#sd-sky>.sv-ph h3::before{background-image:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23d6d0ff%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%2017l6-6%204%204%208-8M15%207h6v6%22/%3E%3C/svg%3E")!important}
html #sv-over .sd-wgrid>#sd-move>.sv-ph h3::before{background-image:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23d6d0ff%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%208h14l-4-4M20%2016H6l4%204%22/%3E%3C/svg%3E")!important}
/* each section's title tags in its own colour, as its tile */
html #sv-over .sd-wgrid>#sd-list>.sv-ph .sv-tag:not(#z):not(#y){color:#8ff5ec!important;border-color:rgba(43,200,189,.55)!important;background:rgba(43,200,189,.14)!important}
html #sv-over .sd-wgrid>#sd-sky>.sv-ph .sv-tag:not(#z):not(#y){color:#ffd58a!important;border-color:rgba(255,176,46,.55)!important;background:rgba(255,176,46,.14)!important}
html #sv-over .sd-wgrid>#sd-move>.sv-ph .sv-tag:not(#z):not(#y){color:#9ff5bd!important;border-color:rgba(46,224,106,.55)!important;background:rgba(46,224,106,.13)!important}
/* the Easy titles anchored: a soft glow of the section's colour behind its tile, a fine hairline under the row - bright
   under the title, fading across the column - so each title heads its column instead of floating in it */
html #sv-over .sd-wgrid>.sd-col>.sv-ph:not(#z){position:relative;padding-bottom:11px!important;margin-bottom:6px!important;isolation:isolate}
html #sv-over .sd-wgrid>.sd-col>.sv-ph::before{content:"";position:absolute;left:-6px;top:50%;width:150px;height:56px;margin-top:-33px;z-index:-1;pointer-events:none;
  background:radial-gradient(ellipse 60% 55% at 30px 50%,color-mix(in srgb,var(--ttc) 26%,transparent),transparent 72%)}
html #sv-over .sd-wgrid>.sd-col>.sv-ph::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;pointer-events:none;
  background:linear-gradient(90deg,var(--ttc) 0%,color-mix(in srgb,var(--ttc) 45%,transparent) 32%,transparent 92%)}
html #sv-over .sd-wgrid>#sd-list>.sv-ph{--ttc:#2bc8bd}html #sv-over .sd-wgrid>#sd-sky>.sv-ph{--ttc:#ffb02e}html #sv-over .sd-wgrid>#sd-move>.sv-ph{--ttc:#2ee06a}
/* the title tiles filled, each in its section's colour, the icon dark on it */
html #sv-over .sd-wgrid>#sd-list>.sv-ph h3::before{background:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%230b0b19%22%20stroke-width%3D%222.4%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%2020V11M12%2020V4M19%2020v-6%22/%3E%3C/svg%3E") center/14px 14px no-repeat,linear-gradient(160deg,#2bc8bd,#1a8f87)!important;border-color:transparent!important;box-shadow:0 0 14px -4px #1a8f87!important}
html #sv-over .sd-wgrid>#sd-sky>.sv-ph h3::before{background:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%230b0b19%22%20stroke-width%3D%222.4%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%2017l6-6%204%204%208-8M15%207h6v6%22/%3E%3C/svg%3E") center/14px 14px no-repeat,linear-gradient(160deg,#ffc453,#ffa31a)!important;border-color:transparent!important;box-shadow:0 0 14px -4px #ffa31a!important}
html #sv-over .sd-wgrid>#sd-move>.sv-ph h3::before{background:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%230b0b19%22%20stroke-width%3D%222.4%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%2018c0-6.6%204.4-10%2010-10h6M16%204l4%204-4%204%22/%3E%3C/svg%3E") center/14px 14px no-repeat,linear-gradient(160deg,#4cf08a,#22c65c)!important;border-color:transparent!important;box-shadow:0 0 14px -4px #22c65c!important}
html #sv-over .sd-wgrid>.sd-col>.sv-ph h3:not(#z):not(#y){background-image:linear-gradient(90deg,#ffffff,#d9d3ff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
html #sv-over .sd-wgrid>.sd-col>.sv-ph .sv-tag:not(#z){color:var(--ws)!important;border-color:var(--wbd2)!important;background:rgba(255,255,255,.04)!important;font-weight:600}
/* Concentration's subtitle on one row */
@media(min-width:700px){#cpop .kp-h p:not(#z){white-space:nowrap;font-size:12px;letter-spacing:-.005em}}
.sv-btn.go.sd-go:disabled{background:rgba(255,255,255,.05);border-color:var(--wbd2);color:var(--wf);box-shadow:none;cursor:not-allowed;margin-top:auto}
.sd-fine{font-size:11px;line-height:1.45;color:var(--wf)}
.sd-fine b{color:var(--wt)}
#sd-move.fill{justify-content:center;align-items:center}
/* Where your stake sits shows its thirds as Move your stake shows its figures: cards */
#sd-list .sd-mv .sd-fig>b{font-size:24px}
/* the barcode: 100 bars in rank order, the held ones tall and bright, the thirds bracketed under it */
.fp-bc{position:relative;flex:1 1 auto;min-height:48px;display:flex;align-items:flex-end;gap:1px;margin-top:6px;padding-bottom:1px;border-bottom:1px solid var(--wbd2)}
.fp-b{flex:1 1 0;min-width:0;border-radius:1px 1px 0 0;cursor:pointer;--c:#ff6a3d;background:color-mix(in srgb,var(--c) 22%,transparent)}
.fp-b.b1{--c:#ffb02e}.fp-b.b2{--c:#2ee06a}
.fp-b.on{background:linear-gradient(180deg,color-mix(in srgb,var(--c) 70%,#fff 30%),var(--c));box-shadow:0 0 8px -1px var(--c)}
.fp-b:hover{background:var(--wt)}
.fp-ax{display:flex;justify-content:space-between;margin-top:4px;font-family:var(--wmono);font-size:8.5px;letter-spacing:.08em;color:var(--wf)}
.fp-br{display:flex;gap:4px;margin-top:8px}
.fp-k{min-width:0;display:flex;flex-direction:column;padding-top:6px;border-top:2px solid #ff6a3d;--rc:#ff6a3d}
.fp-k.b1{--rc:#ffb02e}.fp-k.b2{--rc:#2ee06a}
.fp-k.b3{--rc:#8f8db4;border-color:#6f6d94}.fpt3{color:#b4b2cf}   /* inactive: grey - it earns nothing */
.fp-kb{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0;padding:7px 6px 8px;text-align:center;border:1px solid var(--wbd2);border-radius:9px;
background:radial-gradient(120% 90% at 50% -10%,color-mix(in srgb,var(--rc) 16%,transparent),transparent 65%),linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.01));box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.fp-k.b1{border-color:#ffb02e}.fp-k.b2{border-color:#2ee06a}
.fp-k em{font-style:normal;font-family:var(--wmono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--wf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fp-k b{font-size:18px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.fp-k small{max-width:100%;font-size:9px;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}.fp-k small i{font-style:normal;font-size:7.5px;letter-spacing:.04em;color:var(--wf)}
@media(max-width:620px){.fp-bc{flex:0 0 auto;height:150px}}
@media(min-width:901px) and (max-height:700px){#sd-list .fp-br{margin-top:5px}#sd-list .fp-k{padding-top:4px}#sd-list .fp-k b{font-size:15px}}
.fpt0{color:#ff7a57}.fpt1{color:#ffc453}.fpt2{color:#5cf08e}

.sd-mvh{flex-wrap:nowrap;container-type:inline-size;min-height:27px}
.sd-mvh .sv-tag{flex:0 0 auto}
/* title, +APR pill and "N moves, 1 signature" on one line always; the row's own width tightens them in
   steps: smaller type, then the pill without its "APR", and only on the narrowest the pill gives way */
#sd-move .sd-mvh .sv-tag i{font-style:normal}
#sd-move .sd-mvh{column-gap:8px}   /* on the row itself: a container query cannot style its own container */
@container (max-width:405px){#sd-move .sd-mvh h3{font-size:13px}#sd-move .sd-mvh .sd-mvn{font-size:9.5px}
  #sd-move .sd-mvh .sv-tag{font-size:10px;padding-left:8px;padding-right:8px}}
@container (max-width:345px){#sd-move .sd-mvh>*+*{margin-left:-3px}#sd-move .sd-mvh h3{font-size:12.5px}#sd-move .sd-mvh .sv-tag i{display:none}#sd-move .sd-mvh .sv-tag{padding-left:6px;padding-right:6px}#sd-move .sd-mvh .sd-mvn{font-size:9px}}
@container (max-width:300px){#sd-move .sd-mvh .sv-tag.sd-mvn{display:none}}
.sd-mvh h3{flex:0 0 auto;white-space:nowrap}
.sd-mvh .sd-mvn{margin-left:auto;min-width:0;font-size:11px;color:var(--wf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
/* Move your stake: Now and After side by side, the gain under both, inset like the button below */
.sd-mv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:8px}
.sd-mv .sd-fig{margin-left:0;padding:10px 14px 10px 16px;border-left:1px solid var(--wbd2);border-radius:10px}
.sd-mv .sd-fig::before{top:10px;bottom:10px}
.sd-mv .sd-fig:last-child{grid-column:1/-1}
.sd-mv.four .sd-fig:last-child{grid-column:auto}
.sd-mv .sd-fig{align-items:center;text-align:center}
.sd-mv .sd-fig>b{justify-content:center}
/* Move your stake (and Autopilot's same cards): its own look - the figure large and bare, a short glowing
   rule in the card's colour under it, the card washed in that colour from below */
.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig{gap:4px;border-left:1px solid var(--wbd2);
  background:linear-gradient(0deg,color-mix(in srgb,var(--rc) 14%,transparent),transparent 70%),linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.008))}
.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig::before{display:none}
.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig::after{display:none}
.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig em{font-size:10px;letter-spacing:.2em;color:var(--ws)}
.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig>b{font-size:38px;line-height:1}
/* a big box's number fits its box: never over the box's own size, and never wider than the box (--n is the value's
   visible length, set by fig(); .68em is the widest digit run measured, 147.0% at 38px = 154px) */
.sd-mv .sd-fig{container-type:inline-size}
.sd-mv .sd-fig .fv{font-size:min(1em, calc(100cqi / (var(--n, 6) * .68)));white-space:nowrap}
/* the glowing line sits under the label (Now, After, Gain) */
@media(min-width:901px) and (max-height:700px){.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig em{padding-bottom:5px;margin-bottom:1px}}
@media(min-width:901px) and (max-height:640px){#sv .sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig{padding-top:4px;padding-bottom:4px;gap:2px}#sv .sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig>b{font-size:24px}#sv .sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig:last-child>b{font-size:26px}#sv .sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig em{padding-bottom:0;margin-bottom:0}#sv .sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig em::after{display:none}}
.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig em{position:relative;padding-bottom:7px;margin-bottom:3px}
.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig em::after{content:"";position:absolute;left:50%;bottom:0;width:34px;height:3px;margin-left:-17px;border-radius:2px;background:var(--rc);box-shadow:0 0 10px var(--rc)}
.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig:last-child>b{font-size:40px}
.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig small{font-size:11.5px;color:var(--ws)}
@media(min-width:901px) and (max-height:700px){.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig>b{font-size:28px}.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig:last-child>b{font-size:30px}.sd-mv:is(#sd-move *,#sd-asky *,#sd-sky *,#sd-ado *) .sd-fig{gap:4px}}
/* the boxes stand where the centred block put them (equal room above the block and below it); the
   year rises into the middle of the room between the title and the boxes: the hero takes its own
   height plus half the spare room and centres itself in it, the ::after spacer the other half */
.se-mid{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.se-mid>.se-hero{flex:1 1 auto;justify-content:center}
.se-mid::after{content:"";flex:1 1 0}
.se-mid+.se-fine{margin-top:0}
/* What your stake earns (Wallet) and what Autopilot would do / Your grant (Autopilot): se- */
.sd-off{font-size:11px;color:#ff6a3d;margin:0 2px 8px}   /* stake that earns nothing: red */
.se-hero{display:flex;flex-direction:column;gap:2px;padding:6px 0 12px}
/* the year in its own box, as the day/week/month boxes are - both states */
.se-card{position:relative;display:flex;flex-direction:column;gap:2px;padding:12px 18px 13px;border:1px solid var(--wbd2);border-radius:12px;overflow:hidden;
background:linear-gradient(90deg,rgba(46,224,106,.09),rgba(255,255,255,.012) 70%)}
.se-card::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:2px;border-radius:0 2px 2px 0;background:var(--sv-green);box-shadow:0 0 12px var(--sv-green)}
.se-hero:has(>.se-card){padding:0}

.se-hero em{font-style:normal;font-family:var(--wmono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf)}
.se-hero>b,.se-card>b{display:flex;align-items:baseline;gap:8px;font-size:40px;font-weight:800;letter-spacing:-.03em;line-height:1.05;color:var(--wt);font-variant-numeric:tabular-nums;white-space:nowrap}
.se-hero>b i,.se-card>b i{font-style:normal;font-family:var(--wmono);font-size:11px;font-weight:400;letter-spacing:.14em;color:var(--wf)}
.se-hero small{font-size:12px;line-height:1.35;color:var(--ws)}
.se-hero.sm{padding:10px 0 8px}.se-hero.sm>b{font-size:30px}
.se-row .sd-fig>b{font-size:19px}
/* a little air under the big figures: the year's line, and each box's bottom line */
.se-hero small{margin-top:7px}
.se-hero small.se-apr{color:var(--wf)}   /* the unit under the year, in the shade of its "A year" label */
/* the unit stands under the figure; a short window, with no room for that line, keeps it beside the figure */
#sv-over #sd-sky .se-hero .se-card>b>i{display:none}
@media(min-width:901px) and (max-height:640px){#sv-over #sd-sky .se-hero .se-card>b>i{display:inline}}
/* the APR tag in What your stake earns' band: amber, clear on the fill */
/* APR tags on a band: solid pills, dark type - the clearest thing on the fill (green on Move your stake and
   Enable restake, amber on What your stake earns) */
:is(#sv-over,#sv-auto) .sd-col>.sv-ph .sv-tag.g{color:#03230e;border-color:#2ee06a;background:#2ee06a;font-weight:700}
#sv-over #sd-sky>.sv-ph .sv-tag.a{color:#2a1600;border-color:#ffb02e;background:#ffb02e;font-weight:700}
.se-row .sd-fig small{margin-top:4px}
/* the example (no wallet): figure and boxes centred in the panel, nothing under them */
/* the no-wallet example stands exactly as the connected panel does (.se-mid): boxes where the centred block
   puts them, the year centred between the title and them */
.se-ex{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.se-ex>.se-hero{flex:1 1 auto;justify-content:center}
.se-ex::after{content:"";flex:1 1 0}
.se-fine{margin-top:auto;padding-top:10px;font-size:11px;line-height:1.4;color:var(--wf)}
.se-fine+.se-fine{margin-top:4px;padding-top:0}
.se-say{font-size:13.5px;line-height:1.5;color:var(--ws);margin-top:auto}
.se-say b{color:var(--wt);font-weight:700}
.se-vs{display:flex;align-items:center;gap:16px;padding:8px 0 4px}
.se-vs div{display:flex;flex-direction:column;gap:2px}
.se-vs em{font-style:normal;font-family:var(--wmono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf)}
.se-vs b{font-size:34px;font-weight:800;letter-spacing:-.03em;line-height:1.05;font-variant-numeric:tabular-nums}
.se-vs small{font-size:11.5px;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}
.se-vs>i{font-style:normal;font-size:24px;color:var(--wf);padding-top:12px}
.se-time{padding:4px 0 14px}
.se-tbar{height:10px;border-radius:5px;background:var(--wbd);overflow:hidden}
.se-tbar s{display:block;height:100%;border-radius:5px;background:var(--sv-violet);box-shadow:0 0 10px var(--sv-violet)}
.se-tl{display:flex;justify-content:space-between;gap:10px;margin-top:6px;font-family:var(--wmono);font-size:10px;color:var(--wf)}
.se-tl b{font-family:var(--wsans,inherit);font-size:12.5px;font-weight:700;color:var(--wt)}
.se-mv{display:flex;flex-direction:column;gap:7px}
.se-mv>em{font-style:normal;font-family:var(--wmono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf)}
.se-mv>div{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;font-size:12.5px;color:var(--ws);padding:7px 10px;border:1px solid var(--wbd);border-radius:9px}
.se-mv>div u{text-decoration:none;font-family:var(--wmono);font-size:10.5px;color:var(--wf);padding-top:2px}
.se-mv>div b{color:var(--wt)}
.se-mv>div.none{display:block}
.sd-over{position:absolute;left:16px;right:16px;top:44px;bottom:34px;display:grid;place-items:center;text-align:center;font-size:12.5px;color:var(--ws);pointer-events:none}
.sv-gkey i.sk{background:linear-gradient(90deg,#8a5bb8,#ff7a3c,#ffd662)}
.sv-gkey i.to{background:transparent;border:1.5px dashed var(--sv-green);border-radius:2px}
.sv-gkey i.st{width:1px;height:10px;border-radius:0;background:var(--wf)}
/* the list: flat rows on hairlines, not boxes */
/* Governance: Proposals (gp-) and Core DAOs (gd-) - rows in the Governors' manner */
#sv-proplist{display:flex;flex-direction:column}
.gp-list{display:flex;flex-direction:column;min-height:0;overflow-y:auto;flex:1 1 auto;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent;margin-right:-8px;padding-right:4px}
.gp-r{display:grid;grid-template-columns:44px minmax(0,1fr) 82px minmax(150px,230px);align-items:center;gap:14px;padding:10px 8px;border-top:1px solid var(--wbd);cursor:pointer}
.gp-r:hover{background:rgba(255,255,255,.03)}.gp-r:focus-visible{outline:2px solid var(--sv-teal);outline-offset:-2px}
.gp-r.open{background:rgba(255,255,255,.025)}
.gp-id{font-family:var(--wmono);font-size:12px;color:var(--wf)}
.gp-t{display:flex;flex-direction:column;gap:2px;min-width:0}
.gp-t b{font-size:13.5px;font-weight:700;color:var(--wt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gp-t s{text-decoration:none;font-size:11.5px;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gp-st{justify-self:start;font-family:var(--wmono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;padding:2px 8px;border-radius:999px;border:1px solid currentColor}
.gp-st.p{color:var(--sv-green)}.gp-st.r{color:var(--wburn)}.gp-st.f{color:var(--sv-amber)}.gp-st.v{color:var(--sv-teal)}.gp-st.d{color:var(--wf)}
.gp-v{display:flex;flex-direction:column;gap:3px;min-width:0}
.gp-bar{display:flex;height:6px;border-radius:3px;overflow:hidden;background:var(--wbd)}
.gp-bar i{display:block;height:100%}.gp-bar i.y{background:var(--sv-green)}.gp-bar i.n{background:var(--wburn)}.gp-bar i.a{background:var(--wf)}
.gp-v em{font-style:normal;font-size:12px;font-weight:700;color:var(--wt);font-variant-numeric:tabular-nums}
.gp-v small{font-size:10.5px;color:var(--wf);white-space:nowrap}
.gp-d{padding:4px 8px 14px 66px;border-top:0;display:flex;flex-direction:column;gap:10px;background:rgba(255,255,255,.025)}
.gp-f{display:flex;flex-wrap:wrap;gap:8px 22px;font-size:12px;color:var(--wt)}
.gp-f em{display:block;font-style:normal;font-family:var(--wmono);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--wf)}
.gp-sum{font-size:12px;line-height:1.55;color:var(--ws);white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow-y:auto;padding:10px 12px;border:1px solid var(--wbd);border-radius:8px}
.gd-list{display:flex;flex-direction:column;gap:12px}
.gd-r{padding:12px 14px;border:1px solid var(--wbd);border-radius:10px}
.gd-h{display:flex;align-items:center;gap:10px}.gd-h b{font-size:14px;color:var(--wt)}
.gd-r p{margin:6px 0 0;font-size:12.5px;line-height:1.55;color:var(--ws)}
.gd-note{font-size:12px;line-height:1.55;color:var(--wf)}.gd-note b{color:var(--wt)}.gd-note a{color:var(--sv-teal)}
/* ════ Governance, in the Dashboard's parts: its figures a strip of boxes with engraved wells, each panel's
   title a filled band of its own colour, tags that read clearly on any ground ════ */
.gv-strip{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:0!important;border:1px solid var(--wbd);border-radius:12px;background:var(--wc);overflow:hidden}
.gv-ro{--rc:var(--sv-teal);display:flex;flex-direction:column;min-width:0;padding:12px 14px;border-left:1px solid var(--wbd)}
.gv-ro:first-child{border-left:0}
.gv-ro em{font-style:normal;font-family:var(--wmono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf);white-space:nowrap;margin-bottom:7px}
.gv-ro em::before{content:"";display:inline-block;width:6px;height:6px;margin-right:7px;border-radius:2px;vertical-align:1px;background:var(--rc);box-shadow:0 0 8px var(--rc)}
.gv-ro .sd-well{margin:0;padding:6px 12px;min-height:46px;box-sizing:border-box}
.gv-ro .sd-well>b{font-size:22px}
.gv-ro small{margin-top:7px;font-size:11px;line-height:1.4;color:var(--ws);text-wrap:balance}
/* the bands: Proposals blue, Core DAOs olive gold, Governors rose - none shared with another panel */
:is(#sv-proplist,#sv-daop,#sv-govlist)>.sv-ph{margin:-13px -15px 0;padding:5px 15px 6px;min-height:43px;box-sizing:border-box;flex-wrap:nowrap;border-radius:11px 11px 0 0;border-bottom:1px solid rgba(255,255,255,.08)}
:is(#sv-proplist,#sv-daop,#sv-govlist)>.sv-ph h3{color:#fff;font-size:15px;white-space:nowrap}
:is(#sv-proplist,#sv-daop,#sv-govlist)>.sv-ph h3::before{background:rgba(255,255,255,.9);box-shadow:none}
:is(#sv-proplist,#sv-daop,#sv-govlist)>.sv-ph .sv-gkey{color:rgba(255,255,255,.75);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sv-proplist>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.16),transparent 60%),linear-gradient(315deg,#1d4f8f,#173257 58%,#141633)}
#sv-daop>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.16),transparent 60%),linear-gradient(315deg,#5f6216,#393b15 58%,#19191f)}
#sv-govlist>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.16),transparent 60%),linear-gradient(315deg,#7d2e6e,#461f45 58%,#1a1230)}
/* proposals: the id a small key, the status a clear tag, the tally a firmer bar, Yes the figure */
.gp-id{justify-self:start;padding:2px 7px;border-radius:6px;border:1px solid var(--wbd2);background:rgba(0,0,0,.25);color:var(--ws)}
.gp-r{border-radius:9px;border-top-color:transparent;box-shadow:0 -1px 0 var(--wbd)}
.gp-st{font-weight:600;padding:3px 9px}
.gp-st.p{color:#c9ffdb;border-color:rgba(46,224,106,.6);background:rgba(46,224,106,.16)}
.gp-st.r{color:#ffd6cb;border-color:rgba(255,110,70,.65);background:rgba(255,77,31,.18)}
.gp-st.f{color:#ffe2b0;border-color:rgba(255,176,46,.6);background:rgba(255,176,46,.16)}
.gp-st.v{color:#c8fff9;border-color:rgba(43,200,189,.65);background:rgba(43,200,189,.18)}
.gp-st.d{color:var(--ws);border-color:var(--wbd2);background:rgba(255,255,255,.05)}
.gp-bar{height:8px;border-radius:4px}
.gp-v em{font-size:14px;font-weight:800}
/* core DAOs: side by side, each under its colour line, as the thirds in Where your stake sits */
.gd-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.gd-r{border-top:2px solid var(--sv-teal);background:linear-gradient(180deg,rgba(43,200,189,.06),transparent 60%)}
.gd-r+.gd-r{border-top-color:var(--sv-amber);background:linear-gradient(180deg,rgba(255,176,46,.06),transparent 60%)}
.gd-h b{font-size:15px}
.gd-note{grid-column:1/-1}
/* governors, read only here: the action column holds the site link alone */
#sv-govs .sv-glist .sv-vr{grid-template-columns:28px minmax(0,1.4fr) 84px minmax(0,1fr) 90px minmax(0,1fr) 44px}
/* the constitution reads across the whole panel */
#sv-cons .cn-in{max-width:none;margin:0;padding:0 40px 64px}
/* its header a sepia band across the top of the text, the Governance section's fourth colour */
#sv-cons .cn-hd{margin:0 -40px 26px;padding:24px 40px 18px;border-bottom:1px solid rgba(255,255,255,.08);border-radius:11px 11px 0 0;
background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.16),transparent 60%),linear-gradient(315deg,#6b5a3a,#3b3226 58%,#19171d)}
#sv-cons .cn-hd h1{color:#fff}#sv-cons .cn-hd p{color:rgba(255,255,255,.78)}#sv-cons .cn-hd p b{color:#fff}#sv-cons .cn-hd a{color:#ffe2b0}
@media(max-width:900px){#sv-cons .cn-in{padding:0 16px 48px}#sv-cons .cn-hd{margin:0 -16px 20px;padding:18px 16px 14px}}
@media(max-width:700px){.gv-strip{grid-template-columns:minmax(0,1fr)!important}.gv-ro{border-left:0;border-top:1px solid var(--wbd)}.gv-ro:first-child{border-top:0}
  .gd-list{grid-template-columns:minmax(0,1fr)}}
@media(max-width:700px){.gp-r{grid-template-columns:34px minmax(0,1fr) auto;gap:10px}.gp-v{grid-column:2/-1}.gp-d{padding-left:12px}}
/* Constitution (cn-): the contents on the left, the text in a reading column on the right; each
   scrolls on its own, and the contents follow what is being read */
#sv-cons{justify-content:flex-start}
.cn-wrap{display:grid;grid-template-columns:250px minmax(0,1fr);gap:16px;flex:1 1 0;min-height:0}
.cn-toc{display:flex;flex-direction:column;gap:1px;overflow-y:auto;min-height:0;padding:12px 8px 12px 10px;border:1px solid var(--wbd);border-radius:12px;
background:var(--wc);scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
.cn-toc em{font-style:normal;font-family:var(--wmono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf);padding:2px 8px 8px}
.cn-toc a{display:block;padding:4px 8px;border-radius:6px;color:var(--ws);text-decoration:none;font-size:12px;line-height:1.35;border-left:2px solid transparent}
.cn-toc a.cn-l2{color:var(--wt);font-weight:700;font-size:12.5px;margin-top:8px}.cn-toc a.cn-l2:first-of-type{margin-top:0}
.cn-toc a.cn-l3{padding-left:16px}.cn-toc a.cn-l4{padding-left:28px;font-size:11.5px;color:var(--wf)}
.cn-toc a:hover{background:rgba(255,255,255,.04);color:var(--wt)}
.cn-toc a.on{border-left-color:var(--sv-teal);color:var(--wt);background:color-mix(in srgb,var(--sv-teal) 10%,transparent)}
.cn-toc a:focus-visible{outline:2px solid var(--sv-teal);outline-offset:-2px}
.cn-art{position:relative;overflow-y:auto;min-height:0;border:1px solid var(--wbd);border-radius:12px;background:var(--wc);
scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
.cn-art:focus-visible{outline:2px solid var(--sv-teal);outline-offset:-2px}
.cn-in{max-width:72ch;margin:0 auto;padding:28px 32px 64px;font-size:14.5px;line-height:1.7;color:var(--ws)}
.cn-hd{padding-bottom:18px;margin-bottom:8px;border-bottom:1px solid var(--wbd)}
.cn-hd h1{margin:0;font-size:26px;letter-spacing:-.01em;color:var(--wt);text-wrap:balance}
.cn-hd p{margin:6px 0 0;font-size:12px;line-height:1.5;color:var(--wf)}.cn-hd a{color:var(--sv-teal)}.cn-hd b{color:var(--ws);font-family:var(--wmono);font-weight:400}
.cn-in h2{margin:40px 0 4px;font-size:21px;color:var(--wt);text-wrap:balance;scroll-margin-top:16px}
.cn-in h3{margin:26px 0 2px;font-size:16px;color:var(--wt);text-wrap:balance;scroll-margin-top:16px}
.cn-in h4{margin:20px 0 0;font-size:14.5px;color:var(--sv-teal);scroll-margin-top:16px}
.cn-in h2+h3{margin-top:14px}
.cn-in p{margin:10px 0}.cn-in b{color:var(--wt);font-weight:700}
.cn-in ul{margin:8px 0;padding-left:22px}.cn-in li{margin:4px 0}.cn-in li::marker{color:var(--wf)}
.cn-in ul.cn-terms{list-style:none;padding-left:0}.cn-in ul.cn-terms>li{padding:8px 0;border-bottom:1px solid var(--wbd);margin:0}
.cn-sel{display:none}
@media(max-width:900px){.cn-wrap{grid-template-columns:minmax(0,1fr)}.cn-toc{display:none}
.cn-sel{display:block;width:100%;margin:0 0 14px;height:34px;padding:0 10px;border-radius:8px;border:1px solid var(--wbd2);background:var(--wi);color:var(--wt);font:inherit;font-size:13px}
.cn-in{padding:18px 16px 48px;font-size:14px}}
/* a phone: the frame takes its height from what it holds, so these panels flow with the page instead
   of filling a frame - the constitution scrolls with the page, the proposal list runs its full length */
@media(max-width:620px){.cn-wrap{display:block;flex:none}.cn-art{overflow:visible;border:0;background:transparent}
.cn-in{padding:6px 2px 32px}#sv-proplist{flex:none}.gp-list{overflow:visible;flex:none;margin-right:0;padding-right:0}}
/* every validator, scrolling inside the panel: a thin bar in the theme's own border colour */
.sd-list{display:flex;flex-direction:column;min-height:0;overflow-y:auto;overscroll-behavior:contain;flex:1 1 auto;
scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent;margin-right:-8px;padding-right:4px}
.sd-list::-webkit-scrollbar{width:6px}.sd-list::-webkit-scrollbar-track{background:transparent}
.sd-list::-webkit-scrollbar-thumb{background:var(--wbd2);border-radius:3px}
.sd-list>.sd-vr{flex:0 0 auto}
.sd-vr{--c:var(--wbd2);display:grid;grid-template-columns:26px minmax(0,1fr) auto;align-items:center;gap:11px;padding:8px 6px;border-top:1px solid var(--wbd);border-radius:0}
.sd-vr:first-child{border-top:0}
.sd-vr.click{cursor:pointer}
.sd-vr.click:hover{background:rgba(255,255,255,.03)}
.sd-vr:focus-visible{outline:2px solid var(--sv-teal);outline-offset:-2px}
.sd-vr .sv-lgo{width:26px;height:26px;border-radius:8px;overflow:hidden;display:grid;place-items:center;box-shadow:0 0 0 1.5px var(--c)}
.sd-vr .sv-lgo img,.sd-vr .sv-lgo .lg{width:26px;height:26px;display:grid;place-items:center;object-fit:cover;font-size:10px;font-weight:700;color:#fff}
.sd-vn{display:flex;flex-direction:column;gap:1px;min-width:0}
.sd-vn b{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--wt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sd-vn s{text-decoration:none;font-family:var(--wmono);font-size:10px;color:var(--wf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sd-vr u{text-decoration:none;font-family:var(--wmono);font-size:12.5px;font-weight:700;white-space:nowrap}
.sd-vn s em{font-style:normal}
.sd-vn s em.a{color:var(--sv-amber)}.sd-vn s em.p{color:var(--sv-teal)}.sd-vn s em.l{color:var(--sv-violet)}
.sd-vr u.jl{color:#ff6a3d}
#dmy td.st{padding-left:2px;padding-right:2px}#dmy .dmj,#dmy .dmi{font-size:9px;letter-spacing:0}#dmy .dmj{color:#ff6a3d;font-weight:700}#dmy .dmi{color:var(--wf)}
.sd-al{font-style:normal;font-family:var(--wmono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--sv-violet);border:1px solid rgba(185,176,255,.4);border-radius:4px;padding:0 4px}
.sd-vr.skel .sv-lgo{background:var(--wbd2);opacity:.5;box-shadow:none}
.sd-vr.skel b,.sd-vr.skel s,.sd-vr.skel u{display:block;height:9px;border-radius:3px;background:var(--wbd)}
.sd-vr.skel b{width:60%}.sd-vr.skel s{width:40%;margin-top:4px}.sd-vr.skel u{width:40px}
/* what Autopilot may and may never do */
/* what it may and may never do, side by side: allowed on the left, never on the right */
.sd-can{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:14px;font-size:12px;color:var(--ws);flex:0 0 auto;margin-top:4px}
.sd-can>div{display:flex;flex-direction:column;gap:5px;min-width:0}
/* the list keeps its height: the note under it takes what space is left */
#sd-ado>.sd-fine:last-child{margin-top:auto;padding-top:8px}
#sd-ado.tight>.sv-note{display:none}
#sd-ado.tight .sd-can{font-size:11.5px;gap:10px}#sd-ado.tight .sd-can>div{gap:3px}#sd-ado.tight .sd-can span{line-height:1.3}#sd-ado.tight>.sd-fine{font-size:10.5px;line-height:1.35}
.sd-can u{text-decoration:none;font-family:var(--wmono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:1px}
.sd-can u.ok{color:var(--sv-green)}.sd-can u.no{color:#ff7a57}
.sd-can span{position:relative;padding-left:14px}
.sd-can span::before{content:"";position:absolute;left:2px;top:.55em;width:6px;height:6px;border-radius:50%;background:currentColor}
.sd-can span.ok{color:#8ff0b0}.sd-can span.no{color:#ff9b7a}.sd-can span.dim{color:var(--wf)}
@media(min-width:901px) and (max-height:820px){
  .sd-ro{padding-top:10px;padding-bottom:9px}.sd-well{margin:4px 0 3px;padding:3px 10px 4px}.sd-well>b{font-size:18px}.sd-m{margin-top:6px}.sd-strip .sd-well>b{font-size:19px}.sd-strip .sd-well{min-height:40px}.sd-strip .sd-ro{padding-top:10px;padding-bottom:10px}
  .sd-id{padding:10px 16px;gap:5px}.sd-id h3{font-size:16px}
  .sd-col{padding:11px 14px;gap:8px}.sd-fig{margin-left:-15px}.sd-fig>b{font-size:21px}.sd-fig small{font-size:10px}
  .sd-vr{padding-top:6px;padding-bottom:6px}.sd-go{height:36px}
}
@media(max-width:900px){
  html[data-svs=over] #sv-over,html[data-svs=auto] #sv-auto,html[data-svs=mygov] #sv-mygov{grid-template-rows:none}
  .sd-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
  .sd-id{grid-column:1/-1;flex-direction:row;flex-wrap:wrap;align-items:center}
  .sd-ro{border-left:0;border-top:1px solid var(--wbd)}
  .sd-ro:nth-child(odd){border-left:1px solid var(--wbd)}
  .sd-ro:last-child{grid-column:1/-1;border-left:0}
  .sd-grid{grid-template-columns:minmax(0,1fr)}
  .sd-figs{flex:0 0 auto}.sd-fig{flex:0 0 auto;padding-top:9px;padding-bottom:9px}
}
/* ══ Governors ══ */
#sv-govs,#sv-mygov{justify-content:flex-start;gap:12px}
#sv-govs>*,#sv-mygov>*,#sv-govs>*:not(:first-child),#sv-mygov>*:not(:first-child){margin-top:0}
#sv-govcards{grid-template-columns:repeat(3,minmax(0,1fr))}
#sv-govcards .sv-card{--tc:var(--sv-teal)}
#sv-govlist,#sv-mygovlist{flex:1 1 0;min-height:0;--tc:var(--sv-teal)}
#sv-mygovp{--tc:var(--sv-violet)}
/* Proposals and Core DAOs sit in the same frame: cards on top, the panel under them taking the rest
   (the proposal list scrolls inside it; the DAOs' panel sits right under the cards) */
#sv-props,#sv-daos{justify-content:flex-start;gap:12px}
#sv-props>*,#sv-daos>*,#sv-props>*:not(:first-child),#sv-daos>*:not(:first-child){margin-top:0}
#sv-propcards,#sv-daocards{grid-template-columns:repeat(3,minmax(0,1fr))}
#sv-propcards .sv-card,#sv-daocards .sv-card{--tc:var(--sv-teal)}
#sv-proplist{flex:1 1 0;min-height:0;--tc:var(--sv-teal)}
#sv-daop{flex:0 1 auto;min-height:0;overflow-y:auto;--tc:var(--sv-teal)}
.sv-glist{overflow-y:auto;flex:1 1 auto;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
.sv-glist .sv-vr{flex:0 0 52px;grid-template-columns:28px minmax(0,1.4fr) 84px minmax(0,1fr) 90px minmax(0,1fr) 116px}
.sv-gact{display:grid;grid-template-columns:minmax(0,1fr) 26px;align-items:center;justify-items:end;column-gap:10px}
.sv-gbtn{height:26px;padding:0 12px;border-radius:6px;border:1px solid rgba(43,200,189,.55);background:linear-gradient(180deg,rgba(43,200,189,.2),rgba(43,200,189,.1));
color:#6fe3da;font:600 11.5px var(--wsans);cursor:pointer;white-space:nowrap}
.sv-gbtn:hover{border-color:#2bc8bd;color:#a6f1eb}
.sv-gbtn.stop{border-color:rgba(255,122,87,.5);background:transparent;color:#ff9b7a}
.sv-gbtn.stop:hover{border-color:#ff7a57;color:#ffb89f}
.sv-gbtn.busy{opacity:.55;cursor:progress}
.sv-gbtn:focus-visible{outline:2px solid #2bc8bd;outline-offset:2px}
.sv-glist .sv-vr.me{border-color:var(--sv-violet)}
.sv-glist .sv-vr.click{cursor:pointer}
/* the governor's card */
.gvcard{max-width:460px}
.gvcard .vbadges{padding:14px 28px 0}
.gv-det{margin:12px 28px 0;font-size:12.5px;line-height:1.5;color:var(--ink2)}
.gvcard .vgrid .vv{font-size:13px;overflow-wrap:anywhere}
.gv-rules{margin:14px 28px 0;font-size:11.5px;line-height:1.5;color:var(--ink3)}
.gv-rules b{color:var(--ink)}
.gv-go{display:flex;padding:16px 28px 24px}.gv-go .sv-gbtn{flex:1 1 auto;height:36px;font-size:12.5px}
.gvcard:not(:has(.gv-go)){padding-bottom:20px}
.sv-glist .sv-lgo .lg{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:11px;font-weight:700;color:#fff}
.sv-gst em{font-style:normal;font-family:var(--wmono);font-size:10px;padding:1px 8px;border-radius:999px;border:1px solid currentColor}
.sv-gst em.on{color:var(--sv-green)}.sv-gst em.off{color:var(--wf)}
.sv-gn2{display:flex;flex-direction:column;min-width:0}
.sv-gn2 b{font-size:13px;font-weight:700;color:var(--wt);font-variant-numeric:tabular-nums;white-space:nowrap}
.sv-gn2 s{text-decoration:none;font-size:10.5px;color:var(--wf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv-gweb{font-family:var(--wmono);font-size:10.5px;color:var(--sv-teal);text-decoration:none}
.sv-gweb:hover{text-decoration:underline}
@media(max-width:900px){.sv-glist .sv-vr{grid-template-columns:28px minmax(0,1fr) auto;row-gap:4px;flex-basis:auto;padding-top:8px;padding-bottom:8px}
  .sv-glist .sv-gn2,.sv-glist .sv-gweb{grid-column:2/-1}#sv-govcards{grid-template-columns:minmax(0,1fr)}}
/* ══ Autopilot: one screen to set it up ═══════════════════════════════════════════════
   The terms on the left (strategy, which validators, stake, time, restake), the validator set
   on the right to choose from - search it, narrow it, select one by one or by a rule - and one
   footer across both with the fee, the step and the buttons. A phone shows one side at a time
   (Setup | Validators). Violet is Autopilot's colour, as on its line in the wallet. */
.pop .card.atcard{--av:#b9b0ff;width:min(1040px,100%);max-width:none;height:min(700px,100%);max-height:none;padding:0;
display:flex;flex-direction:column;overflow:hidden}
.pop .card.atcard::before{content:"";position:absolute;left:24px;right:24px;top:0;height:1px;background:linear-gradient(90deg,transparent,var(--av),transparent);opacity:.9}
.atcard .wk-txh{flex:0 0 auto}
.atcard .txsum{color:#c9c2ff}
.atcard .txsum .atclosed{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:5px;border:1px solid rgba(255,176,46,.4);background:rgba(255,176,46,.08);font-family:var(--wmono);font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--wamber);white-space:nowrap}
.atview{display:none}
.atbody{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:minmax(0,440px) minmax(0,1fr)}
.atL{min-height:0;overflow-y:auto;padding:6px 20px 16px;border-right:1px solid var(--wbd);scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent}
.atR{min-height:0;display:flex;flex-direction:column;padding:14px 20px 0 18px}
/* the state of a standing grant */
.atstate{margin:10px 0 4px;padding:10px 12px;border:1px solid rgba(46,224,106,.28);border-radius:6px;background:rgba(46,224,106,.05);font-family:var(--wmono);font-size:9px;letter-spacing:.04em;color:var(--ws);line-height:1.7}
.atstate b{color:#fff8dc;font-weight:400}
.atstate .g{color:var(--wgreen)}
.atstate[hidden],.atform[hidden]{display:none}
/* the terms: each category's name above its controls */
.atrow{display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:10px 0;border-top:1px solid var(--wbd)}
.atrow:first-child{border-top:0}
.atlab{font-family:var(--wmono);font-size:7.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--wf)}
.atpre{display:grid;gap:6px;position:relative}
.atpre.at3{grid-template-columns:repeat(3,minmax(0,1fr))}
.atpre.at2{grid-template-columns:repeat(2,minmax(0,1fr))}
.atpc{display:grid;grid-template-columns:14px minmax(0,1fr);grid-template-areas:"r b" "r e";column-gap:8px;row-gap:2px;align-items:center;padding:7px 9px;
border:1px solid var(--wbd2);border-radius:6px;background:linear-gradient(180deg,#12122a,#0b0b18);cursor:pointer;transition:border-color .12s,box-shadow .12s}
.atpc:hover{border-color:var(--ws)}
.atpc:has(input:checked){border-color:var(--av);box-shadow:0 0 0 3px rgba(185,176,255,.12)}
.atpc input{grid-area:r;appearance:none;-webkit-appearance:none;width:14px;height:14px;margin:0;border-radius:50%;border:1px solid var(--wbd2);background:var(--wi);position:relative;cursor:pointer}
.atpc input:checked{border-color:var(--av)}
.atpc input:checked::after{content:"";position:absolute;left:3px;top:3px;width:6px;height:6px;border-radius:50%;background:var(--av);box-shadow:0 0 8px var(--av)}
.atpc input:focus-visible{outline:2px solid var(--av);outline-offset:2px}
.atpc b{grid-area:b;font-family:var(--wsans);font-size:11.5px;font-weight:600;color:#fff8dc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.atpc em{grid-area:e;font-style:normal;font-family:var(--wmono);font-size:8px;letter-spacing:.1em;color:var(--av);white-space:nowrap}
.at3 .atpc:nth-child(1) b{color:#8ef0c8}.at3 .atpc:nth-child(2) b{color:#c9c2ff}.at3 .atpc:nth-child(3) b{color:#ffc453}
/* a strategy's risk in its own colour, and a "?" that explains it: the note opens under the row
   (hover, or a tap on a phone, which focuses it) and a tap on the "?" never changes the choice */
.at3 .atpc{grid-template-columns:14px minmax(0,1fr) auto;grid-template-areas:"r b h" "r e h";column-gap:6px;padding-right:7px}
.at3 .atpc em{font-family:var(--wsans);font-size:10px;letter-spacing:0;font-weight:600}
.at3 .atpc:nth-child(1) em{color:#2ee06a}.at3 .atpc:nth-child(2) em{color:#c9c2ff}.at3 .atpc:nth-child(3) em{color:#ff9a3c}
.athelp{grid-area:h;align-self:center;width:15px;height:15px;border-radius:50%;border:1px solid var(--wbd2);display:grid;place-items:center;
font-style:normal;font-family:var(--wsans);font-size:10px;font-weight:700;line-height:1;color:var(--ws);cursor:help;position:relative}
.athelp::after{content:"";position:absolute;inset:-12px}
.athelp:hover,.athelp:focus-visible{border-color:var(--av);color:var(--av);outline:none}
.attip{display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:6;padding:9px 12px 10px;border:1px solid var(--wbd2);border-radius:8px;
background:#15152c;box-shadow:0 14px 30px -12px rgba(0,0,0,.8);font-family:var(--wsans);font-size:11.5px;line-height:1.5;color:var(--ws);white-space:normal;pointer-events:none}
.attip b{color:#fff8dc;font-weight:600}
.athelp:hover+.attip,.athelp:focus+.attip{display:block}
.atrow:has(.atfield){flex-direction:row;flex-wrap:wrap;align-items:center;column-gap:12px}
.atrow:has(.atfield) .atlab{flex:0 0 100%}
.atcard .unfield.atfield{width:240px;height:30px}
.atcard .unfield.atfield:focus-within{border-color:var(--av);box-shadow:0 0 0 3px rgba(185,176,255,.13)}
/* the line under the stake field is always there, empty or not: a message appearing ("Select
   validators", a cap over the balance) must not push the rows below it down */
.atcard .atrow .unhint{flex:0 0 auto;display:block;min-width:0;height:13px;line-height:13px;margin:0;font-family:var(--wmono);font-size:8.5px;letter-spacing:.06em;color:var(--wf);
white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.atcard .atrow .unhint.bad{color:var(--wamber)}
.attime{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.atseg{display:inline-flex;gap:4px;padding:3px;border:1px solid var(--wbd2);border-radius:6px;background:var(--wi)}
.atseg button{height:24px;padding:0 12px;border:0;border-radius:4px;background:transparent;color:var(--ws);font-family:var(--wmono);font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
.atseg button[aria-pressed=true]{background:var(--av);color:#1b1440}
.atseg button:focus-visible{outline:2px solid var(--av);outline-offset:2px}
/* the restake pair sits on its own in the row: as wide as its buttons, like the months */
#atrsk{align-self:flex-start}
#atrsk button{min-width:52px}
.atuntil{font-family:var(--wmono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--ws)}
.atuntil b{font-family:var(--wsans);font-size:11.5px;font-weight:600;letter-spacing:0;text-transform:none;color:#fff8dc;margin-left:4px}
.atnote{display:flex;align-items:center;gap:8px;margin:12px 0 0;padding:8px 10px;border-radius:6px;border:1px solid rgba(46,224,106,.28);background:rgba(46,224,106,.06);font-family:var(--wsans);font-size:11px;letter-spacing:-.005em;color:#d9f7e4;white-space:nowrap}
.atnote span{min-width:0}.atnote span b{color:#fff8dc;font-weight:700}
.atnote svg{width:15px;height:15px;flex:0 0 auto;fill:none;stroke:#2ee06a;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin:0;max-height:none}
/* the validators: a head with the count and the quick rules, a search and a filter, the list */
.atrh{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}
.atrt{display:flex;flex-direction:column;gap:3px;min-width:0}
.atrt b{font-family:var(--wsans);font-size:13px;font-weight:600;color:#fff8dc}
.atrt span{font-family:var(--wmono);font-size:9px;letter-spacing:.06em;color:var(--ws)}
.atrt span b{font-family:var(--wmono);font-size:9px;font-weight:400;color:var(--av)}
.atrs{display:flex;align-items:center;gap:8px;margin-top:12px}
.atfind{flex:1 1 auto;min-width:0;height:30px;padding:0 10px;margin:0;border-radius:6px;border:1px solid var(--wbd2);background:var(--wi);color:#fff8dc;font-family:var(--wsans);font-size:12px;outline:none;-webkit-appearance:none;appearance:none}
.atfind::placeholder{color:var(--wf)}
.atfind:focus{border-color:var(--av);box-shadow:0 0 0 3px rgba(185,176,255,.13)}
/* the gutter is kept whether the list scrolls or not: "Selected" can show three rows where "All"
   shows a hundred, and a scrollbar that came and went moved every column sideways */
.atlist{flex:1 1 auto;min-height:0;overflow-y:auto;margin-top:10px;scrollbar-width:thin;scrollbar-color:var(--wbd2) transparent;overscroll-behavior:contain;scrollbar-gutter:stable}
.atlist th:last-child,.atlist td:last-child{padding-right:12px}
.atlist th.ck{padding:0 0 0 6px;text-align:left}
.atlist table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}
.atlist thead th{position:sticky;top:0;z-index:1;height:28px;padding:0 5px;background:#12122a;border-top:1px solid var(--wbd2);border-bottom:1px solid var(--wbd2);
font-family:var(--wmono);font-size:7.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:400;color:#c1bfdc;text-align:right;white-space:nowrap}
.atlist thead th:first-child{border-left:1px solid var(--wbd2);border-radius:5px 0 0 5px}
.atlist thead th:last-child{border-right:1px solid var(--wbd2);border-radius:0 5px 5px 0}
.atlist th.l,.atlist td.l{text-align:left}
.atlist td{height:32px;padding:0 5px;border-bottom:1px solid #22223c;text-align:right;font-family:var(--wmono);font-size:10.5px;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:clip;cursor:pointer}
.atlist tr:hover td{background:#171730}
.atlist tr.on td{background:rgba(185,176,255,.06)}
.atlist tr.on td:first-child{box-shadow:inset 2px 0 0 var(--av)}
.atlist.ro td{cursor:default}
.atlist td.ck{padding:0 0 0 6px}
.atlist th.ck input,.atlist td.ck input{appearance:none;-webkit-appearance:none;display:block;width:15px;height:15px;margin:0;border-radius:4px;border:1px solid var(--wbd2);background:linear-gradient(180deg,#17172f,#0e0e1d);position:relative;cursor:pointer}
.atlist th.ck input:checked,.atlist th.ck input:indeterminate,.atlist td.ck input:checked{background:linear-gradient(180deg,#d4ceff,#9d93f0);border-color:var(--av);box-shadow:0 0 0 3px rgba(185,176,255,.14)}
.atlist th.ck input:indeterminate::after{content:"";position:absolute;left:3px;top:6px;width:7px;height:2px;border-radius:1px;background:#1b1440}
.atlist th.ck input:checked::after,.atlist td.ck input:checked::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;border:solid #1b1440;border-width:0 2px 2px 0;transform:rotate(45deg)}
.atlist th.ck input:focus-visible,.atlist td.ck input:focus-visible{outline:2px solid var(--av);outline-offset:2px}
.atlist th.ck input:disabled,.atlist td.ck input:disabled{cursor:default}
.atlist .nmw{display:flex;align-items:center;gap:7px;min-width:0}
.atlist .nmw>span.nmt{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--wsans);font-size:11.5px;color:#fff8dc}
.atlist .wk-lg{width:16px;height:16px;margin:0;flex:0 0 auto}
.atlist .wk-lgx{flex:0 0 16px;width:16px;height:16px;line-height:16px;font-size:7px;text-align:center;font-family:var(--wmono);color:#fff}
.atlist .attg{flex:0 0 auto;font-family:var(--wmono);font-size:6.5px;letter-spacing:.12em;text-transform:uppercase;line-height:1;padding:3px 5px;border-radius:3px;border:1px solid}
.atlist .attg.y{color:var(--wamber);border-color:rgba(255,176,46,.4)}
.atlist .attg.f{color:var(--av);border-color:rgba(185,176,255,.4)}
.atlist td.ok{color:var(--wgreen)}.atlist td.warn{color:var(--wamber)}.atlist td.bad{color:var(--wburn)}.atlist td.dim{color:var(--wf)}
.atlist td.r2 b{font-weight:400;color:var(--wgreen)}
.atlist .atnone{padding:28px 12px;text-align:center;font-family:var(--wsans);font-size:12px;color:var(--wf);cursor:default;white-space:normal}
/* the footer across both sides: the fee and the step on the left, the buttons on the right */
/* the footer keeps the card's two columns: the actions centred under the setup, the fee and the
   signing steps beside them under the list */
.atfoot{flex:0 0 auto;display:grid;grid-template-columns:minmax(0,440px) minmax(0,1fr);grid-template-areas:"b f";align-items:center;padding:12px 0 14px;border-top:1px solid var(--wbd)}
.atcard .atfoot .txbtns{grid-area:b;justify-content:center;}
.atfoot .atfs{grid-area:f;padding:0 20px}
.atfs{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}
.atcard .atfoot .txfee,.atcard .atfoot .txstep{padding:0;min-height:0}
.atcard .atfoot .txfee{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.atcard .atfoot .txfee:empty,.atcard .atfoot .txstep:empty{display:none}
.atcard .atfoot .txbtns{flex:0 0 auto;padding:0;margin:0;border:0}
.atcard .wk-btn[hidden]{display:none}
.atcard .wk-btn.wk-go{background:linear-gradient(180deg,#c9c2ff,#9d93f0);border:1px solid var(--av);color:#1b1440;box-shadow:0 10px 24px -12px rgba(185,176,255,.8),inset 0 1px 0 rgba(255,255,255,.3)}
.atcard .wk-btn.wk-go:disabled{background:linear-gradient(180deg,#1d1d36,#15152a);border-color:#2f2f52;color:#66648c;box-shadow:none;opacity:1}
.atcard .wk-btn.wk-danger{border-color:rgba(255,77,31,.45);color:#ff8a66;background:transparent}
.atcard .wk-btn.wk-danger:hover{border-color:var(--wburn);color:var(--wburn)}
/* a short window: the terms closer together */
@media(max-height:760px) and (min-width:621px){
  .atrow{padding:7px 0;gap:5px}
  .atpc{padding:5px 8px}
  .atnote{margin-top:8px;padding:6px 10px}
}
/* a phone: the whole viewport less a margin to tap outside, and one side at a time */
@media(max-width:620px){
  .pop .card.atcard{height:100%}
  .atview{display:flex;gap:4px;margin:10px 16px 0;padding:3px;border:1px solid var(--wbd2);border-radius:8px;background:var(--wi);flex:0 0 auto}
  .atview button{flex:1 1 0;height:34px;border:0;border-radius:6px;background:transparent;color:var(--ws);font-family:var(--wmono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
  .atview button b{font-weight:400;color:var(--av);margin-left:4px}
  .atview button[aria-selected=true]{background:var(--av);color:#1b1440}
  .atview button[aria-selected=true] b{color:#1b1440}
  .atview button:focus-visible{outline:2px solid var(--av);outline-offset:2px}
  .atbody{grid-template-columns:minmax(0,1fr)}
  .atcard[data-v=setup] .atR,.atcard[data-v=vals] .atL{display:none}
  .atL{border-right:0;padding:4px 16px 14px}
  .atR{padding:12px 16px 0}
  .atrs{flex-wrap:wrap}
  .atfind{flex:1 1 100%;height:36px}
  .atlist td{height:40px}
  .atcard .unfield.atfield{width:100%;max-width:260px}
  .atfoot{grid-template-columns:minmax(0,1fr);grid-template-areas:"f" "b";row-gap:8px;padding:10px 0 12px}
  .atfoot .atfs{padding:0 16px}
  .atcard .atfoot .txbtns{padding:0 16px}
  .atnote{white-space:normal}
}
/* ══ the navigation shell ═══════════════════════════════════════════════════════════
   Two levels that must never look alike. Level 1 - the sections - is chrome: words in
   the 46px header, the open one a 6px-cornered tint of its own accent. Level 2 - one
   section's views - is an in-page control on the window's title line: a pill track, the
   open view a filled pill, one size smaller. Which tabs exist, their labels, routes,
   order and groups all come from shell.json (the rules keyed on them are generated and
   follow this block); nothing here names a tab. */
:root{--l1-on:var(--ink);--l2-on:var(--ink);--l2-on-ink:var(--void);--l2-off:#4e4c70}
.folder>.l1{grid-area:nav}
/* the network switch: two links, the open network lit; testnet lights amber so a page on the
   test chain can never pass for the real one */
/* the one screen (2026-09-30): the wallet control shows on every path - the wallet column is on every path too, and it
   can be folded away (until then it showed only in the Dashboard) */
/* ════ Autopilot setup, Easy mode: five numbered steps in plain words, larger controls, a short list ════ */
#atpop .atrow:not(#z){gap:8px;padding:10px 0}
.pop .card.atcard:not(#z){height:min(920px,100%)}
#atpop .atlab:not(#z){display:grid;grid-template-columns:22px 1fr;column-gap:9px;align-items:center;font-family:var(--wsans);font-size:13px;font-weight:700;letter-spacing:0;text-transform:none;color:#fff8dc}
#atpop .atlab i{grid-row:1/3;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-family:var(--wmono);font-size:10px;font-weight:700;color:#1b1440;background:var(--av);box-shadow:0 0 10px -2px var(--av)}
#atpop .atlab small{grid-column:2;font-family:var(--wsans);font-size:11px;font-weight:400;color:var(--ws)}
#atpop .atrow:has(.atfield) .atlab{flex:0 0 100%}
#atpop .atpre{padding-left:31px}
#atpop .atpc:not(#z){display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:10px 12px 11px 34px;position:relative;border-radius:10px;min-height:0}
#atpop .atpc input:not(#z){position:absolute;left:11px;top:12px;width:15px;height:15px}
#atpop .atpc b:not(#z){font-size:13.5px;font-weight:700;white-space:normal}
#atpop .atpc em:not(#z){font-family:var(--wsans);font-size:11px;font-weight:600;letter-spacing:0}
#atpop .atpc .atd{font-size:10.5px;line-height:1.35;color:var(--ws)}
#atpop .athelp:not(#z){position:absolute;right:8px;top:9px}
#atpop .atpre.at3:not(#z){grid-template-columns:minmax(0,1fr);gap:6px}
#atpop .atpre.at3 .atpc:not(#z){display:grid;grid-template-columns:auto auto 1fr;grid-template-areas:"b e d";align-items:baseline;column-gap:10px;padding:9px 12px 9px 34px}
#atpop .atpre.at3 .atpc b{grid-area:b}#atpop .atpre.at3 .atpc em{grid-area:e}#atpop .atpre.at3 .atpc .atd{grid-area:d;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#atpop .atpre.at3 .atpc input:not(#z){top:50%;margin-top:-7.5px}
#atpop .athelp:not(#z),#atpop .attip{display:none!important}
/* the reason, at the top of the setup */
#atpop .atidle{margin:12px 0 2px;padding:10px 12px;border-radius:10px;border:1px solid rgba(43,200,214,.4);background:linear-gradient(90deg,rgba(43,200,214,.14),rgba(43,200,214,.04));font-size:12px;line-height:1.5;color:var(--ws)}
#atpop .atidle b{color:#fff8dc;font-weight:700}#atpop .atidle b.n{color:#ff8a8a}
#atpop .atrow>.wk-field,#atpop .atrow>.attime,#atpop .atrow>.atseg,#atpop .atrow>.unhint{margin-left:31px}
#atpop .unfield.atfield:not(#z){width:280px;height:38px}
#atpop .unfield.atfield input{font-size:15px}
#atpop .atseg button:not(#z){height:30px;padding:0 16px;font-size:9.5px}
#atpop .atuntil:not(#z){font-size:10px}
#atpop .atrsh{margin-left:10px;font-size:11px;color:var(--ws);align-self:center}
#atpop .atrow:has(#atrsk){flex-direction:row;flex-wrap:wrap;align-items:center}
#atpop .atrow:has(#atrsk) .atlab{flex:0 0 100%}
#atpop .atnote:not(#z){margin-top:14px;padding:10px 12px;font-size:12px;border-radius:9px}
/* the list: taller rows, the name and the APR larger */
#atpop .atrt b:not(#z){font-size:15px;font-weight:700}
#atpop .atfind:not(#z){height:36px;font-size:13px;border-radius:9px}
#atpop .atlist td:not(#z){height:40px;font-size:12px}
#atpop .atlist thead th:not(#z){height:30px}
#atpop .atlist .nmw>span.nmt:not(#z){font-size:13px;font-weight:600}
#atpop .atlist .wk-lg,#atpop .atlist .wk-lgx{width:20px;height:20px;flex-basis:20px;line-height:20px}
#atpop .atlist td.r2 b{font-size:13px;font-weight:700}
#atpop .atlist .attg:not(#z){font-size:7.5px;padding:3px 6px}
#atpop .atlist td.ck input:not(#z){width:17px;height:17px}
/* Grant: the big green door, as Redelegate */
#atpop .txbtns .wk-go:not(#z){min-width:180px;height:40px;font-size:13px;font-weight:700;border-radius:10px}
@media(max-height:760px){#atpop .atrow:not(#z){padding:8px 0;gap:6px}#atpop .atpc .atd{display:none}#atpop .atlab small{display:none}#atpop .atlist td:not(#z){height:34px}}
/* the setup wider, the list narrower; no step numbers; the setup never scrolls - it fits, tightening on short windows */
@media(min-width:861px){#atpop .atbody:not(#z){grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}
  #atpop .atL:not(#z){overflow:visible}
  #atpop .atpre.at3:not(#z){grid-template-columns:repeat(3,minmax(0,1fr))}
  #atpop .atpre.at3 .atpc:not(#z){display:flex;flex-direction:column;align-items:flex-start;padding:10px 12px 11px 34px}
  #atpop .atpre.at3 .atpc input:not(#z){top:12px;margin-top:0}
  #atpop .atpre.at3 .atpc .atd{text-align:left;white-space:normal}}
#atpop .atlab i{display:none}
#atpop .atlab:not(#z){display:flex;flex-direction:column;align-items:flex-start;gap:1px}
#atpop .atpre,#atpop .atrow>.wk-field,#atpop .atrow>.attime,#atpop .atrow>.atseg,#atpop .atrow>.unhint{padding-left:0;margin-left:0}
@media(min-width:861px) and (max-height:1000px){#atpop .atrow:not(#z){padding:8px 0;gap:6px}#atpop .atidle:not(#z){margin-top:8px;padding:8px 11px;font-size:11.5px}#atpop .atlab small{display:none}}
@media(min-width:861px) and (max-height:860px){#atpop .atpc .atd{display:none}#atpop .atnote:not(#z){margin-top:8px}#atpop .atpc:not(#z){padding-top:8px;padding-bottom:8px}}
@media(min-width:861px) and (max-height:760px){#atpop .atidle{display:none!important}#atpop .atrow:not(#z){padding:6px 0;gap:5px}#atpop .atnote:not(#z){margin-top:6px;padding:6px 10px}}
@media(min-width:861px) and (max-height:640px){#atpop .atL:not(#z){overflow-y:auto}}
/* within 48 hours: the keeper proposes, an admin acts */
#atpop .atnote:not(#z),#atpop .atnote span:not(#z){white-space:normal;overflow:visible;text-overflow:clip;line-height:1.45}
.ap-48{padding:9px 12px;border-radius:9px;border:1px solid rgba(43,200,214,.4);background:rgba(43,200,214,.08);font-size:12px;color:var(--ws)}
.ap-48 b{color:#8ff5ec;font-weight:700}
#sv-auto .ap-act .ap-48s{font-style:normal;font-size:11px;color:var(--wf)}
.sd-ida .sd-wch i.st.rs{color:rgba(255,255,255,.7);border-color:rgba(255,255,255,.28);background:rgba(255,255,255,.06)}
.sd-ida .sd-wch i.st.rs.on{color:#b6f5cb;border-color:rgba(143,240,176,.6);background:rgba(46,224,106,.16)}
.sd-ida .sd-wch button.rsw:not(#z){cursor:pointer;font-style:normal;font-family:var(--wmono);font-size:8.5px;line-height:1;letter-spacing:.14em;text-transform:uppercase;padding:3px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:rgba(255,255,255,.8);height:auto}
.sd-ida .sd-wch button.rsw.on:not(#z){color:#b6f5cb;border-color:rgba(143,240,176,.6);background:rgba(46,224,106,.16)}
.sd-ida .sd-wch button.rsw:hover{border-color:rgba(255,255,255,.6)}.sd-ida .sd-wch button.rsw:focus-visible{outline:2px solid #fff;outline-offset:2px}
#atpop .atpc em:empty{display:none}
/* the list opens only for Choose yourself, as a second column; with Autopilot's own pick the card is the setup alone */
.pop .card.atcard[data-pick=auto]:not(#z){width:min(560px,100%)}
@media(min-width:861px){#atpop .atcard[data-pick=auto] .atbody:not(#z){grid-template-columns:minmax(0,1fr)}#atpop .atcard[data-pick=auto] .atL:not(#z){border-right:0}
  .pop .card.atcard[data-pick=auto]:not(#z){height:auto;max-height:100%}}
.atcard[data-pick=auto] .atR{display:none!important}
.atcard[data-pick=auto] .atview{display:none!important}
/* Choose yourself: the setup keeps its exact width and height, the list opens beside it at that height */
@media(min-width:861px){
  .pop .card.atcard:not(#z){height:auto;max-height:100%;width:min(560px,100%);transition:width .18s ease}
  .pop .card.atcard[data-pick=selected]:not(#z){width:min(1040px,100%)}
  #atpop .atcard .atbody:not(#z){grid-template-columns:minmax(0,550px) minmax(0,1fr)}
  #atpop .atcard[data-pick=auto] .atbody:not(#z){grid-template-columns:minmax(0,1fr)}
  #atpop .atcard[data-pick=selected] .atR:not(#z){contain:size;min-height:100%}}
/* Grant (and Back, Revoke, Change) centred under the card */
#atpop .atfoot:not(#z){display:flex;flex-direction:column-reverse;align-items:center;gap:6px}#atpop .atfoot .txbtns:not(#z){justify-content:center;margin:0 auto}#atpop .atfoot .atfs:not(#z){text-align:center}
/* ════ Autopilot tab: Restake under the Autopilot card (its width, as Pro's panes under the wallet card), one
   compact 'What Autopilot does' panel in the middle, Validators on the right ════ */
@media(min-width:901px){
  #sv-auto .sd-agrid.sd-agrid:not(#z){grid-template-columns:max(calc((100% - 2px) * 0.242424 + 2px),250px) minmax(0,1.5fr) minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr) minmax(0,1fr)}
  #sv-auto #sd-ars{grid-column:1;grid-row:1/3}#sv-auto #sd-ado{grid-column:2;grid-row:1}#sv-auto #sd-asky{grid-column:2;grid-row:2}#sv-auto #sd-alist{grid-column:3;grid-row:1/3}
  #sv-auto .sd-agrid:has(#sd-asky:empty) #sd-ado{grid-row:1/3}}
#sv-auto #sd-asky:empty{display:none}
#sv-auto #sd-ars{--bandf:#0b4a36,#073024 58%,#05140f;--tc:var(--sv-green);position:relative}
#sv-auto #sd-ars>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.07),transparent 60%),linear-gradient(315deg,#0b4a36,#073024 58%,#05140f)}
#sv-auto #sd-ars::after{content:"";display:block;position:absolute;inset:-1px;border-radius:12px;padding:0 3px 3px;background:linear-gradient(315deg,var(--bandf));pointer-events:none;z-index:2;
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
/* the compact panel: two labelled rows of four small boxes, centred in the panel */
#sv-auto .ap-dd{flex:1 1 auto;display:flex;flex-direction:column;justify-content:stretch;gap:8px;min-height:0}
/* the rows told apart by two shining lines only - green over what it does, red over what it never does */
#sv-auto .ap-dd>.ap-ln{display:block;flex:0 0 2px;height:2px;border-radius:2px;margin:2px 0}
#sv-auto .ap-dd>.ap-ln.ok{background:linear-gradient(90deg,transparent,#2ee06a 18%,#9ff5bd 50%,#2ee06a 82%,transparent);box-shadow:0 0 10px rgba(46,224,106,.7),0 0 22px rgba(46,224,106,.35)}
#sv-auto .ap-dd>.ap-ln.no{background:linear-gradient(90deg,transparent,#ff5a4a 18%,#ffb0a4 50%,#ff5a4a 82%,transparent);box-shadow:0 0 10px rgba(255,90,74,.7),0 0 22px rgba(255,90,74,.35)}
#sv-auto .ap-dd:not(#z){gap:10px}
/* the two rows share the panel's height equally, each box filling its row */
#sv-auto .ap-dd>.ap-row{flex:1 1 0;min-height:0}
#sv-auto .ap-row>.ap-cb{justify-content:center;height:100%;box-sizing:border-box}
/* every box's label and line on one level: the caption always holds two lines, so the stacks are the same height */
#sv-auto .ap-cb small{min-height:2.7em;display:flex;align-items:flex-start;justify-content:center}
#sv-auto .ap-dd>u{text-decoration:none;font-family:var(--wmono);font-size:9px;letter-spacing:.16em;text-transform:uppercase}
#sv-auto .ap-dd>u.ok{color:#8ff0b0}#sv-auto .ap-dd>u.no{color:#ff8a8a;margin-top:4px}
#sv-auto .ap-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
#sv-auto .ap-cb{--rc:#2bc8d6;display:flex;flex-direction:column;align-items:center;text-align:center;gap:3px;padding:10px 8px 11px;min-width:0;border:1px solid var(--wbd2);border-radius:10px;
  background:linear-gradient(0deg,color-mix(in srgb,var(--rc) 9%,transparent),rgba(255,255,255,.012) 70%)}
#sv-auto .ap-cb em{font-style:normal;font-family:var(--wmono);font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;padding-bottom:5px;position:relative}
#sv-auto .ap-cb em::after{content:"";position:absolute;left:50%;bottom:0;width:24px;height:2px;margin-left:-12px;border-radius:2px;background:var(--rc)}
#sv-auto .ap-cb b{font-size:20px;font-weight:800;letter-spacing:-.02em;color:var(--wt);white-space:nowrap}
#sv-auto .ap-cb.no b{color:#ff8a8a}#sv-auto .ap-cb.ok b{color:var(--sv-green)}
#sv-auto .ap-cb small{font-size:10.5px;line-height:1.35;color:var(--ws);text-wrap:balance}
@media(min-width:901px) and (max-width:1399px){#sv-auto .ap-cb b{font-size:17px}#sv-auto .ap-cb small{font-size:10px}}
/* a long value (more than 11 characters) is set smaller inside its line, so the line keeps every box's height */
#sv-auto .ap-cb b .lvs{font-size:.8em}
@media(min-width:901px) and (max-height:760px){#sv-auto .ap-cb{padding:5px 6px 6px;gap:2px}#sv-auto .ap-dd{gap:5px}#sv-auto .ap-cb small{font-size:9.5px;line-height:1.25}#sv-auto .ap-cb b{font-size:15px}#sv-auto .ap-cb em{padding-bottom:3px}}
@media(max-width:700px){#sv-auto .ap-row{grid-template-columns:repeat(2,minmax(0,1fr))}}
/* Restake: its figure, its fixed rules, its switch */
#sv-auto #sd-ars{justify-content:flex-start}
#sv-auto .ars-fig{display:flex;flex-direction:column;align-items:center;gap:3px;margin-top:10px;padding:14px 10px;border:1px solid var(--wbd2);border-radius:10px;text-align:center;
  background:linear-gradient(0deg,rgba(46,224,106,.1),rgba(255,255,255,.012) 70%)}
#sv-auto .ars-fig em{font-style:normal;font-family:var(--wmono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--ws)}
#sv-auto .ars-fig>b{font-size:30px;font-weight:800;letter-spacing:-.02em;color:var(--sv-green);white-space:nowrap}
#sv-auto .ars-fig>b i{font-style:normal;font-size:11px;font-weight:600;color:var(--wf)}
#sv-auto .ars-fig small{font-size:11.5px;color:var(--ws)}
/* as the other figure boxes: the label with its short accent line, the value, the APR on the row below */
#sv-auto .ars-fig em{position:relative;padding-bottom:6px;margin-bottom:2px}
#sv-auto .ars-fig em::after{content:"";position:absolute;left:50%;bottom:0;width:28px;height:2px;margin-left:-14px;border-radius:2px;background:var(--sv-green);box-shadow:0 0 8px var(--sv-green)}
#sv-auto .ars-rules{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--ws)}
#sv-auto .ars-rules li{position:relative;padding-left:14px}
#sv-auto .ars-rules li::before{content:"";position:absolute;left:2px;top:.55em;width:6px;height:6px;border-radius:50%;background:var(--sv-green)}
#sv-auto .ars-rules b{color:var(--wt)}
/* frequency and minimum as two small boxes, the way it compounds as one full-width box */
#sv-auto .ars-two{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
#sv-auto .ars-two>div{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 6px;border:1px solid var(--wbd2);border-radius:10px;text-align:center;
  background:linear-gradient(0deg,rgba(46,224,106,.07),rgba(255,255,255,.012) 70%)}
#sv-auto .ars-two em{font-style:normal;font-family:var(--wmono);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ws)}
#sv-auto .ars-two b{font-size:17px;font-weight:800;color:var(--wt);white-space:nowrap}
#sv-auto .ars-how{margin-top:8px;padding:10px 10px;border:1px solid rgba(46,224,106,.35);border-radius:10px;text-align:center;font-size:12px;line-height:1.45;color:var(--ws);
  background:rgba(46,224,106,.07);text-wrap:balance}
#sv-auto .ars-how b{color:var(--sv-green)}
#sv-auto .ars-foot{margin-top:auto;padding-top:8px}
/* windows 821 to 1000px tall (a 1440x900 browser): the whole panel a step tighter so the switch stays in */
@media(min-width:901px) and (min-height:821px) and (max-height:1000px){
  #sv-auto #sd-ars>.ars-fig:not(#z):not(#y){margin-top:8px;padding-top:6px;padding-bottom:7px}
  #sv-auto #sd-ars .ars-fig>b:not(#z):not(#y){font-size:22px;line-height:1.2}
  #sv-auto #sd-ars .ars-how:not(#z):not(#y){padding:5px 8px;font-size:10.5px;line-height:1.3}
  #sv-auto #sd-ars .sd-go:not(#z):not(#y){height:36px}}
@media(min-width:901px) and (max-height:700px){#sv-auto #sd-ars .ars-fig>b:not(#z):not(#y){font-size:19px;line-height:1.2}#sv-auto #sd-ars>.ars-fig:not(#z):not(#y){padding-top:4px;padding-bottom:5px}}
@media(min-width:901px) and (max-height:640px){#sv-auto #sd-ars .ars-how:not(#z):not(#y){padding:3px 6px;font-size:9.5px;line-height:1.25}#sv-auto #sd-ars .ars-two:not(#z):not(#y){margin-top:4px;gap:5px}}
/* no empty middle: the year box grows into the room above the rules, its content centred in it */
#sv-auto #sd-ars>.ars-fig:not(#z){flex:1 1 auto;justify-content:center;min-height:0}
#sv-auto #sd-ars .ars-foot:not(#z){margin-top:0}
/* the year box's content larger, the 'runs until' line a row lower under its rule */
#sv-auto #sd-ars .ars-fig>em:not(#z):not(#y){font-size:10.5px;letter-spacing:.18em}
#sv-auto #sd-ars .ars-fig>b:not(#z):not(#y){font-size:36px;line-height:1.15}
#sv-auto #sd-ars .ars-fig>small:not(#z):not(#y){font-size:13px}
#sv-auto #sd-ars .ars-until:not(#z):not(#y){margin-top:18px;padding-top:12px;font-size:12.5px}
@media(min-width:901px) and (max-width:1599px){#sv-auto #sd-ars .ars-fig>b:not(#z):not(#y){font-size:32px}}
@media(min-width:901px) and (max-height:1000px){#sv-auto #sd-ars .ars-fig>b:not(#z):not(#y){font-size:28px}#sv-auto #sd-ars .ars-fig>small:not(#z):not(#y){font-size:12px}#sv-auto #sd-ars .ars-until:not(#z):not(#y){margin-top:12px;padding-top:8px;font-size:11.5px}}
@media(min-width:901px) and (max-height:700px){#sv-auto #sd-ars .ars-fig>b:not(#z):not(#y){font-size:22px}#sv-auto #sd-ars .ars-fig>small:not(#z):not(#y){font-size:11px}#sv-auto #sd-ars .ars-until:not(#z):not(#y){margin-top:5px;padding-top:4px;font-size:10.5px}}
@media(min-width:901px) and (max-height:640px){#sv-auto #sd-ars .ars-fig>b:not(#z):not(#y){font-size:19px}#sv-auto #sd-ars .ars-until:not(#z):not(#y){margin-top:2px;padding-top:2px;border-top:0}}
/* the active grant's panels: 'Your grant' in indigo (the crimson belonged to the old 'What it doesn't'); the working
   panel's figures fill its height */
#sv-auto #sd-asky{--bandf:#3a2f8f,#241d63 58%,#141033}
#sv-auto #sd-asky>.sv-ph:not(#z){background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.12),transparent 60%),linear-gradient(315deg,#3a2f8f,#241d63 58%,#141033)}
#sv-auto #sd-ado>.sd-figs.two{flex:1 1 auto;min-height:0}
/* active, shorter windows: the working summary compact, 'Your grant' keeps the latest moves that fit */
#sv-auto #sd-asky .se-mv{min-height:0;overflow:hidden}
@media(min-width:901px) and (max-height:1000px){#sv-auto #sd-asky .se-mv>div:nth-of-type(n+3){display:none}#sv-auto #sd-ado .sd-ok:not(#z){padding:6px 10px;font-size:12px}}
@media(min-width:901px) and (max-height:760px){#sv-auto #sd-ado .sd-ok{display:none}#sv-auto #sd-asky .se-mv>div:nth-of-type(n+2){display:none}
  #sv-auto #sd-ado .sd-fig:not(#z){padding-top:4px;padding-bottom:4px}#sv-auto #sd-ado .sd-fig>b:not(#z){font-size:18px}#sv-auto #sd-ado .sd-fig small{display:none}}
/* the state pill: one shape for both, green when enabled, grey when not */
#sv-auto #sd-ars>.sv-ph .sv-tag.ars-st:not(#z):not(#y){font-family:var(--wsans);font-size:10px;font-weight:700;letter-spacing:0;text-transform:none;padding:2px 9px;color:#e6e4f0!important;border-color:rgba(255,255,255,.35)!important;background:rgba(255,255,255,.14)!important}
#sv-auto #sd-ars>.sv-ph .sv-tag.ars-st.on:not(#z):not(#y){color:#03230e!important;border-color:#2ee06a!important;background:#2ee06a!important}
/* enabled: the grant's expiry, inside the year box under a fine rule */
#sv-auto .ars-until{display:block;margin-top:6px;padding-top:6px;border-top:1px solid rgba(46,224,106,.25);width:88%;font-size:11px;color:var(--ws)}
#sv-auto #sd-ars .ars-until b:not(#z){font-size:inherit;letter-spacing:0;line-height:inherit;color:var(--wt);font-weight:700;display:inline}
@media(min-width:901px) and (max-height:700px){#sv-auto .ars-until{margin-top:3px;padding-top:3px;font-size:10px}}
/* enabled (the expiry line in the year box): the rules below a step tighter so it all stays in the panel */
@media(min-width:901px) and (max-height:1000px){#sv-auto #sd-ars .ars-two small{display:none}#sv-auto #sd-ars .ars-two>div:not(#z){padding:7px 6px 8px}
  #sv-auto #sd-ars>.ars-fig:not(#z){margin-top:6px;padding-top:6px;padding-bottom:7px}#sv-auto #sd-ars .ars-fig>b:not(#z){font-size:22px}
  #sv-auto #sd-ars .ars-how:not(#z){padding:5px 8px}}
@media(min-width:901px) and (max-height:640px){#sv-auto #sd-ars .ars-fig>small{display:none}#sv-auto #sd-ars .ars-two>div:not(#z):not(#y){padding:4px 6px 5px;gap:2px}#sv-auto #sd-ars .ars-two b:not(#z):not(#y){font-size:14px}#sv-auto #sd-ars .ars-two em{padding-bottom:3px}#sv-auto #sd-ars .ars-how:not(#z){padding:3px 6px;font-size:9.5px}#sv-auto #sd-ars .ars-until{border-top:0;margin-top:0;padding-top:0}}
/* the year box a little lower under the title, on the taller windows */
#sv-auto #sd-ars>.ars-fig:not(#z){margin-top:18px}
@media(min-width:901px) and (max-height:1000px){#sv-auto #sd-ars>.ars-fig:not(#z){margin-top:12px}}
@media(min-width:901px) and (max-height:700px){#sv-auto #sd-ars>.ars-fig:not(#z){margin-top:4px}}
/* Frequency and Minimum built as the other boxes: the label with its accent line, the value, a caption - squarer */
#sv-auto .ars-two>div:not(#z){justify-content:center;gap:4px;padding:10px 8px 11px;min-height:0;box-sizing:border-box}
@media(min-width:901px) and (max-height:760px){#sv-auto .ars-two>div:not(#z):not(#y){padding:7px 6px 8px;gap:3px}#sv-auto .ars-two b:not(#z):not(#y){font-size:16px}}
#sv-auto .ars-two em{position:relative;padding-bottom:5px}
#sv-auto .ars-two em::after{content:"";position:absolute;left:50%;bottom:0;width:24px;height:2px;margin-left:-12px;border-radius:2px;background:var(--sv-green)}
#sv-auto .ars-two b:not(#z){font-size:20px}
#sv-auto .ars-two small{font-size:10.5px;color:var(--ws)}
/* narrower columns: the year box and the compounding line a step tighter */
@media(min-width:901px) and (max-width:1599px){#sv-auto #sd-ars .ars-fig:not(#z){padding-top:9px;padding-bottom:10px}#sv-auto #sd-ars .ars-fig>b:not(#z){font-size:26px}
  #sv-auto #sd-ars .ars-how:not(#z){font-size:11px;line-height:1.35;padding:7px 8px}}

@media(min-width:901px) and (max-height:640px){#sv-auto #sd-ars .ars-fig em:not(#z){display:none}#sv-auto #sd-ars .ars-fig:not(#z){gap:0;padding:4px 8px}
  #sv-auto #sd-ars .ars-foot:not(#z){padding-top:4px}#sv-auto #sd-ars .ars-how:not(#z){font-size:10px;line-height:1.25;padding:4px 6px}#sv-auto #sd-ars .sd-go:not(#z){margin-top:3px;height:26px}}
#sv-auto #sd-ars .sd-go{margin-top:8px}
#sv-auto #sd-ars .sd-go.ars-off:not(#z){background:rgba(255,77,31,.12);border:1px solid rgba(255,110,70,.6);color:#ffb7a3;box-shadow:none}
@media(min-width:901px) and (max-height:760px){#sv-auto .ars-fig{padding:9px 8px;margin-top:6px}#sv-auto .ars-fig>b{font-size:24px}#sv-auto .ars-rules{gap:3px;margin-top:6px;font-size:11px}}
@media(min-width:901px) and (max-height:700px){#sv-auto .ars-fig:not(#z){margin-top:4px;padding:5px 8px;gap:0}#sv-auto .ars-fig>b{font-size:20px}#sv-auto .ars-fig small{font-size:10.5px}
  #sv-auto .ars-two:not(#z){margin-top:5px;gap:5px}#sv-auto .ars-two b{font-size:13px}
  #sv-auto .ars-how:not(#z){margin-top:5px;padding:5px 8px;font-size:10.5px;line-height:1.3}#sv-auto .ars-rules:not(#z){margin-top:4px;font-size:10.5px}
  #sv-auto #sd-ars .sd-go:not(#z){height:32px}#sv-auto #sd-ars>.sv-ph{margin-bottom:0!important}}
@media(min-width:901px) and (max-height:640px){#sv-auto .ap-act:not(#z){gap:6px;padding:4px 8px}#sv-auto .ap-act b{font-size:17px}#sv-auto .ap-act span{font-size:11.5px;line-height:1.4}#sv-auto .ap-act .ap-go:not(#z){margin-top:2px}}
/* the list's head is its search bar, the live count at its right end: the list takes the rest */
#atpop .atR>.atrs:not(#z){margin-top:0}
#atpop .atrs .wk-seln:not(#z){flex:0 0 auto;min-width:0;margin-left:4px;font-family:var(--wmono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ws)}
#atpop .atrs .wk-seln b:not(#z){font-family:var(--wmono);font-size:11px;font-weight:700;letter-spacing:0;color:var(--wgreen);margin-right:5px}
#atpop .atrs .wk-seln:empty{display:none}
/* ════ Dashboard > Govern, built as the other tabs: the strip (its card indigo), Your governor under the card at its
   width, the governors in the middle, what is being voted on at the right; bands and frames as Autopilot's ════ */
@media(min-width:901px){#sv-mygov .sd-ggrid:not(#z){grid-template-columns:max(calc((100% - 2px) * 0.242424 + 2px),250px) minmax(0,1.6fr) minmax(0,1fr)}}
#sv-mygov .sd-ggrid{min-height:0}
#sv-mygov .sd-col>.sv-ph:not(#z){margin:-11px -14px 0;padding:5px 14px 6px;min-height:43px;box-sizing:border-box;flex-wrap:nowrap;border-radius:11px 11px 0 0;border-bottom:1px solid rgba(255,255,255,.08)}
#sv-mygov .sd-col>.sv-ph h3{color:#fff!important;white-space:nowrap}
#sv-mygov .sd-col>.sv-ph h3::before{background:rgba(255,255,255,.9)!important;box-shadow:none!important}
#sv-mygov .sd-col>.sv-ph .sv-tag{color:#fff;border-color:rgba(255,255,255,.42);background:rgba(8,6,20,.34);padding:2px 7px;font-size:9px}
#sv-mygov #sv-mygovp{--bandf:#4a3aa8,#2c2170 58%,#150f3b}#sv-mygov #sv-mygovlist{--bandf:#7d2e6e,#461f45 58%,#1a1230}#sv-mygov #sd-gvote{--bandf:#1d4f8f,#173257 58%,#141633}
#sv-mygov #sv-mygovp>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.12),transparent 60%),linear-gradient(315deg,#4a3aa8,#2c2170 58%,#150f3b)}
#sv-mygov #sv-mygovlist>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.12),transparent 60%),linear-gradient(315deg,#7d2e6e,#461f45 58%,#1a1230)}
#sv-mygov #sd-gvote>.sv-ph{background:radial-gradient(90% 180% at 100% 0%,rgba(255,255,255,.12),transparent 60%),linear-gradient(315deg,#1d4f8f,#173257 58%,#141633)}
#sv-mygov .sd-col{position:relative}
#sv-mygov .sd-col::after{content:"";display:block;position:absolute;inset:-1px;border-radius:12px;padding:0 3px 3px;background:linear-gradient(315deg,var(--bandf));pointer-events:none;z-index:2;
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
#sv-mygov .sd-col::before{display:none}
/* plain words, no box */
#sv-mygov .gv-say{margin:12px 0 0;font-size:14px;line-height:1.5;color:var(--wt)}
#sv-mygov .gv-say b{color:#c9c2ff}
#sv-mygov .gv-sub{margin:8px 0 0;font-size:12px;line-height:1.55;color:var(--ws)}
/* the governors fill their panel and scroll inside it */
#sv-mygov #sv-mygovlist .sv-glist{flex:1 1 auto;min-height:0;overflow-y:auto;margin-top:10px}
#sv-mygov #sv-mygovp .sv-glist{margin-top:12px}
/* voting now: each open proposal a card - its id, title, the yes/no bar, when it ends */
#sv-mygov .gv-live{display:flex;flex-direction:column;gap:8px;margin-top:10px;min-height:0;overflow-y:auto}
#sv-mygov .gv-lp{display:flex;flex-direction:column;gap:5px;padding:10px 12px;border:1px solid var(--wbd2);border-radius:10px;text-decoration:none;
  background:linear-gradient(0deg,rgba(43,140,214,.08),rgba(255,255,255,.012) 70%)}
#sv-mygov .gv-lp:hover{border-color:#5a8fd6}
#sv-mygov .gv-lp em{font-style:normal;font-family:var(--wmono);font-size:10px;color:var(--wf)}
#sv-mygov .gv-lp b{font-size:13px;color:var(--wt);line-height:1.35}
#sv-mygov .gv-lp small{font-size:11px;color:var(--ws)}
@media(max-width:900px){#sv-mygov .sd-col>.sv-ph:not(#z){margin:-14px -16px 0;padding:5px 16px 6px}}
/* the empty states carry the facts: two boxes of what happens, the chain's rules for governors, the latest results */
#sv-mygov .gv-how{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
#sv-mygov .gv-how>div,#sv-mygov .gv-rules3>div{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 8px;border:1px solid var(--wbd2);border-radius:10px;text-align:center;
  background:linear-gradient(0deg,rgba(185,176,255,.08),rgba(255,255,255,.012) 70%)}
#sv-mygov .gv-how em,#sv-mygov .gv-rules3 em{font-style:normal;font-family:var(--wmono);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ws);position:relative;padding-bottom:5px}
#sv-mygov .gv-how em::after,#sv-mygov .gv-rules3 em::after{content:"";position:absolute;left:50%;bottom:0;width:24px;height:2px;margin-left:-12px;border-radius:2px;background:#b9b0ff}
#sv-mygov .gv-how b{font-size:13px;color:var(--wt)}
#sv-mygov .gv-rules3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
#sv-mygov .gv-rules3>div{background:linear-gradient(0deg,rgba(213,90,180,.1),rgba(255,255,255,.012) 70%);padding:16px 8px}
#sv-mygov .gv-rules3 em::after{background:#e07ac8}
#sv-mygov .gv-rules3 b{font-size:22px;font-weight:800;color:var(--wt)}
#sv-mygov .gv-rules3 small{font-size:11px;color:var(--ws)}
#sv-mygov .gv-rl{display:block;margin-top:14px;text-decoration:none;font-family:var(--wmono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf)}
#sv-mygov .gv-lh{display:flex;align-items:center;justify-content:space-between;gap:8px}
#sv-mygov .gv-lh .gp-st{font-style:normal}
/* the latest results: as many whole cards as the window holds, never a card cut in half */
#sv-mygov .gv-live{overflow:hidden!important}
#sv-mygov .gv-live>.gv-lp:nth-child(n+4){display:none}
@media(min-width:901px) and (max-height:1100px){#sv-mygov .gv-live>.gv-lp:nth-child(n+3){display:none}}
@media(min-width:901px) and (max-height:760px){#sv-mygov .gv-live>.gv-lp:nth-child(n+2){display:none}#sv-mygov .gv-rules3>div{padding:10px 6px}#sv-mygov .gv-rules3 b{font-size:17px}}
@media(min-width:901px) and (max-height:640px){#sv-mygov .gv-sub{display:none}#sv-mygov .gv-rules3 small{display:none}#sv-mygov .gv-how>div{padding:7px 6px}#sv-mygov .gv-say:not(#z){margin-top:6px;font-size:12.5px}#sv-mygov .gv-rl:not(#z){margin-top:6px}#sv-mygov .gv-lp:not(#z){padding:6px 10px;gap:3px}#sv-mygov .gv-live:not(#z){margin-top:5px}}
@media(max-width:900px){#sv-mygov .gv-live>.gv-lp:nth-child(n+3){display:none}}
/* Manage (a grant that stands, read-only): the card keeps a real height so its list shows; the status as boxes */
@media(min-width:861px){.pop .card.atcard[data-view="1"]:not(#z){height:min(620px,100%)}#atpop .atcard[data-view="1"] .atR:not(#z){contain:none}}
#atpop .atstate:not(#z){margin:12px 0 4px;padding:0;border:0;background:none;font-family:var(--wsans);font-size:12px;letter-spacing:0;color:var(--ws);line-height:1.5}
#atpop .atsb{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px}
#atpop .atsb>div{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;border:1px solid var(--wbd2);border-radius:10px;text-align:center;
  background:linear-gradient(0deg,rgba(185,176,255,.08),rgba(255,255,255,.012) 70%)}
#atpop .atsb em{font-style:normal;font-family:var(--wmono);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ws);position:relative;padding-bottom:5px}
#atpop .atsb em::after{content:"";position:absolute;left:50%;bottom:0;width:24px;height:2px;margin-left:-12px;border-radius:2px;background:#b9b0ff}
#atpop .atsb b{font-family:var(--wsans);font-size:18px;font-weight:800;color:#fff8dc;white-space:nowrap}
#atpop .atsb small{font-size:10.5px;color:var(--ws)}
/* the setup's validator count: Redelegate's live count, at the right of the list's title */
#atpop .atrt:not(#z){display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
#atpop .atrh,#atpop .atrt:not(#z){width:100%}
#atpop .atrt .wk-seln:not(#z){min-width:0;margin-left:auto;font-family:var(--wmono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ws)}
#atpop .atrt .wk-seln b:not(#z){font-family:var(--wmono);font-size:11px;font-weight:700;letter-spacing:0;color:var(--wgreen);margin-right:5px}
/* the network switch: two small engraved keys in a recessed track, the wallet pill's height (32px) and its
   mono type; the open network's key lit from within (teal mainnet, amber testnet) */
.netsw{display:inline-flex;align-items:center;height:32px;box-sizing:border-box;padding:3px;gap:3px;border-radius:10px;flex:0 0 auto;
border:1px solid rgba(0,0,0,.45);background:linear-gradient(180deg,rgba(0,0,0,.42),rgba(0,0,0,.2));
box-shadow:inset 0 2px 6px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,255,255,.05),0 1px 0 rgba(255,255,255,.05)}
.netsw a{height:24px;display:inline-flex;align-items:center;padding:0 9px;border-radius:7px;font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;
color:#7c7aa3;text-decoration:none;white-space:nowrap;transition:color .15s,background .15s}
.netsw a:hover{color:var(--wt,#f0eef8)}
.netsw a[aria-current=page]{color:#bff6f1;background:linear-gradient(180deg,rgba(43,200,189,.28),rgba(43,200,189,.12));box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 10px -3px rgba(43,200,189,.8)}
.netsw a#nettest[aria-current=page]{color:#ffe2ad;background:linear-gradient(180deg,rgba(255,176,46,.3),rgba(255,176,46,.12));box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 10px -3px rgba(255,176,46,.8)}
.netsw a:focus-visible{outline:2px solid #2bc8bd;outline-offset:1px}
.netsw .ns{display:none}
@media(max-width:620px){.netsw a{padding:0 7px;font-size:9px;letter-spacing:.08em}.netsw .nl{display:none}.netsw .ns{display:inline}}
.brandwrap{grid-area:brand;justify-self:start;display:flex;align-items:center;min-width:0}
.brandwrap>.brand{grid-area:auto}
/* the live height under the wordmark, at its right end (as before 2026-09-27); on testnet it moves left
   and says so */
.bheight{position:absolute;right:0;top:100%;margin-top:1px}
.bheight{display:inline-flex;align-items:center;justify-content:flex-end;min-width:9ch;gap:5px;font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;color:#7c7aa3;line-height:1;font-variant-numeric:tabular-nums}
.bheight i{width:4px;height:4px;border-radius:50%;background:var(--green);box-shadow:0 0 5px var(--green)}
.bheight b{font-weight:400}
/* the title's tag: "Autopilot", fixed on every network and in every state (operator, 2026-09-30; the network
   shows in the wallet and the switch). The height moves left, as testnet's did, and the tag hangs after it */
.bheight{right:auto;left:calc(22% - 2px);justify-content:flex-start;min-width:0}
.btag{margin-left:1px;color:#2bc8bd;white-space:nowrap}
.folder>.hdr-r{grid-area:right;justify-self:end;display:flex;align-items:center;gap:8px;min-width:0}
.hdr-r .thbtn{margin-left:0;width:32px;height:32px;border-radius:8px}
.hdr-r .sv-who{flex:0 0 auto}
.hdr-r .sv-btn.sml{height:32px}
.l1{display:flex;align-items:center;gap:4px;min-width:0}
.l1tab{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 13px;border:0;border-radius:6px;
background:transparent;color:var(--ink2);font:inherit;font-family:var(--sans);font-size:13px;font-weight:400;line-height:1;white-space:nowrap;cursor:pointer;
transition:color .15s,background .15s}
/* every tab is a 44px target, whatever its drawn height */
.l1tab::after,.l2tab::after{content:"";position:absolute;left:0;right:0;top:50%;height:44px;transform:translateY(-50%)}
.l1tab:hover,.l2tab:hover{color:var(--ink)}
.l1tab:focus-visible,.l2tab:focus-visible{outline:2px solid var(--acc,var(--hot));outline-offset:2px}
.l1badge{font-style:normal;font-family:var(--mono);font-size:7px;letter-spacing:.14em;text-transform:uppercase;color:var(--hot);border:1px solid;border-radius:99px;
padding:2px 5px;line-height:1;opacity:.85}
.brandbar [data-title-for]{display:none}
.brandbar .tsfx.net{color:#2bc8bd}
.brandbar .sv-brand{flex:0 1 auto}
.l2host{margin-left:auto;display:flex;align-items:center;min-width:0;max-width:100%}
.l2{display:none;align-items:center;min-width:0;max-width:100%}
.l2trk{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:999px;border:1px solid var(--edge2);background:var(--inset);max-width:100%}
.l2tab{position:relative;flex:0 0 auto;display:inline-flex;align-items:center;height:28px;padding:0 14px;border:0;border-radius:999px;background:transparent;
color:var(--ink2);font:inherit;font-family:var(--sans);font-size:12px;font-weight:400;line-height:1;white-space:nowrap;cursor:pointer;transition:color .15s,background .15s}
/* a section with twice the usual views: named groups on one line, a hairline between */
.l2.split{align-items:flex-end;gap:12px}
.l2g{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0}
.l2gl{font-family:var(--mono);font-size:7.5px;letter-spacing:.16em;text-transform:uppercase;color:#7c7aa3;padding-left:10px;line-height:1}
.l2div{align-self:stretch;width:.5px;background:var(--edge2)}
/* label and track share the 50px title line: the pills there run a little smaller */

.l2.split .l2tab{height:25px;}
/* a split row's views are words, not pills: the open one in full ink over a short bar of the
   section's accent (the generated rule sets --l2-lit), the others quiet. The pill track is left
   to the version switch, so the two controls never read as one */
.l2.split{--l2-on:transparent;--l2-on-ink:var(--ink)}
.l2.split .l2trk{gap:4px;padding:0;border:0;border-radius:0;background:none}
.l2.split .l2tab{padding:0 10px;border-radius:0;font-size:12.5px}
.l2.split .l2tab::before{content:"";position:absolute;left:10px;right:10px;bottom:-2px;height:2px;border-radius:2px;background:var(--acc);
transform:scaleX(var(--l2-lit,0));transition:transform .2s}
/* a view that is off - announced, or not part of the open version - stays in its place,
   greyed, and does nothing */
.l2tab[aria-disabled=true],.l2tab[aria-disabled=true]:hover{color:var(--l2-off);cursor:not-allowed}
/* a section's group switch (the dashboard's Staking | Governance): a two-pill track at the end
   of the row; it is a pair of toggle buttons, not tabs. The row between shows the open group's
   views only (the generated rules show one .l2g by html[data-grp]); the switch names the group,
   so the group's own label and the hairline between groups are not needed */
.l2.grp .l2g,.l2.grp .l2div,.l2.grp .l2gl{display:none}
.l2vb[aria-disabled=true],.l2vb[aria-disabled=true]:hover{color:var(--l2-off);cursor:not-allowed}
.l2ver{display:none;flex-direction:column;align-items:flex-start;gap:3px;align-self:flex-end}
.l2ver .l2trk{padding:2px}
.l2vb{position:relative;flex:0 0 auto;display:inline-flex;align-items:center;height:25px;padding:0 12px;border:0;border-radius:999px;background:transparent;
color:var(--ink2);font:inherit;font-family:var(--sans);font-size:12px;font-weight:400;line-height:1;white-space:nowrap;cursor:pointer;transition:color .15s,background .15s}
.l2vb::after{content:"";position:absolute;left:0;right:0;top:50%;height:44px;transform:translateY(-50%)}
.l2vb:hover{color:var(--ink)}
.l2vb:focus-visible{outline:2px solid var(--acc,var(--hot));outline-offset:2px}
/* the dashboard's title line: the lockup, the views centred on the window, the switch at
   the end. Three columns, the outer two equal, so the views sit on the true centre */
@media(min-width:621px){
  html[data-sec=dashboard] .w#calc>.brandbar{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;column-gap:16px}
  html[data-sec=dashboard] .brandbar .l2host{display:contents}
  html[data-sec=dashboard] .brandbar .l2.split{grid-column:2;align-self:center}
  html[data-sec=dashboard] .brandbar .l2ver{grid-column:3;justify-self:end;align-self:center}
}
/* too narrow for three equal columns: the views centre in what the lockup and the switch
   leave, both controls run tighter; under 820px the lockup is its mark alone, and under
   700px it steps aside (the header above already carries the AtomOne mark) */
@media(min-width:621px) and (max-width:900px){
  html[data-sec=dashboard] .w#calc>.brandbar{grid-template-columns:auto minmax(0,1fr) auto;column-gap:12px}
  html[data-sec=dashboard] .brandbar .l2.split{justify-self:center}
  .l2.split .l2tab{padding:0 8px}
  .l2.split .l2tab::before{left:8px;right:8px}
  .l2.split .l2gl{padding-left:8px}
  .l2vb{padding:0 10px}
}
@media(min-width:621px) and (max-width:819px){html[data-sec=dashboard] .brandbar .sv-bw{display:none}}
@media(min-width:621px) and (max-width:699px){html[data-sec=dashboard] .brandbar .sv-brand{display:none}}
/* the shell's own panes: a view with nothing built yet, or the one connect screen */
.shell-box{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--edge);border-radius:8px;background:var(--card)}
.shell-empty{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;max-width:46ch;padding:24px}
.shell-empty h2{margin:0;font-size:18px;font-weight:700;color:var(--ink)}
.shell-empty p{margin:0;font-size:13px;line-height:1.5;color:var(--ink2)}
.shell-act{margin-top:4px;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border:1px solid var(--edge2);border-radius:8px;
background:transparent;color:var(--ink);font:inherit;font-size:12.5px;text-decoration:none;cursor:pointer}
.shell-act:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
.shell-act:hover{border-color:var(--ink3)}
.shell-act:focus-visible{outline:2px solid var(--hot);outline-offset:2px}
[role=tabpanel]:focus{outline:none}
[role=tabpanel]:focus-visible{outline:2px solid var(--hot);outline-offset:-2px}
html[data-tab=connect] .l2host{display:none}
/* level 1 between phone and desktop: three equal columns stop fitting under ~870px (the
   controls need 218px), so the sections centre in what the mark and the controls leave;
   under 800px not even that fits (four sections), and the header takes the phone's two lines */
@media(min-width:621px) and (max-width:900px){
  .folder{grid-template-columns:auto minmax(0,1fr) auto}
  .folder>.l1{justify-self:center}
}
@media(min-width:621px) and (max-width:799px){
  .folder{height:auto;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"brand right" "nav nav";padding:6px 20px 4px;row-gap:2px}
  .folder>.l1{justify-self:stretch;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;width:100%}
  .l1tab{height:36px}
}
@media(max-width:620px){
  /* level 1: the mark and the controls on one line, the sections spread across the next */
  .folder{height:auto;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"brand right" "nav nav";padding:6px 12px 4px;row-gap:2px}
  .l1{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;width:100%}
  .l1tab{height:36px;padding:0 6px}
  /* level 2: under the title, a chip row that scrolls sideways with no bar showing; a
     split row becomes two, each keeping its label */
  .w#calc>.brandbar{flex-wrap:wrap;row-gap:8px}
  .l2host,.l2{flex:1 1 100%;margin-left:0}
  .l2trk{overflow-x:auto;scrollbar-width:none;padding:5px}
  .l2trk::-webkit-scrollbar{display:none}
  .l2tab{height:34px}
  .l2.split{flex-direction:column;align-items:stretch;gap:8px}
  .l2g{align-items:stretch}
  .l2div{display:none}
  .l2host{flex-wrap:wrap;row-gap:8px}
  .l2.split .l2trk{padding:0 0 4px}
  .l2ver{flex:1 1 100%;align-items:stretch}
  .l2ver .l2trk{display:grid;grid-template-columns:1fr 1fr;padding:5px}
  .l2vb{height:34px;justify-content:center}
  /* a section's views share the row evenly and all show (Network has five): no chip cut at either end */
  .l2:not(.split) .l2trk{display:flex;width:100%;box-sizing:border-box;padding:3px}
  .l2:not(.split) .l2tab{flex:1 1 auto;justify-content:center;padding:0 6px;font-size:11.5px}
}
/* ── the phone, 2026-09-27 audit (dev/phone.js): the page scrolls, so nothing fills "the rest of the
   height" - lists stand at their own height; card rows stack; long lines wrap ── */
@media(max-width:620px){
  #sv-proplist,#sv-govlist,#sv-mygovlist{flex:0 0 auto;min-height:0}
  #sv-proplist .gp-list,.sv-glist{flex:0 0 auto;overflow:visible;max-height:none}
  #sv-propcards,#sv-daocards,#sv-govcards{grid-template-columns:minmax(0,1fr)}
  .sv-gkey{white-space:normal;flex-wrap:wrap;row-gap:4px}
  /* a date axis at quarters is eight labels; the phone shows every other one (half-years) */
  .sv-gxt span:nth-child(even){display:none}
  /* Picks: the column is the screen's width, not the table's; the tables lay out fixed - rank, the
     name taking what is left (cut with an ellipsis), the figures in narrow columns */
  .duotab{grid-template-columns:minmax(0,1fr)}
  .ptab{table-layout:fixed;width:100%}
  .ptab th:first-child,.ptab td:first-child{width:30px}
  .ptab th:nth-child(n+3),.ptab td:nth-child(n+3){width:15%;padding-left:4px;padding-right:6px}
  .ptab td:nth-child(n+3){font-size:10.5px}
  .ptab .nm{max-width:none;min-width:0}
  /* Self: the delegations list is as tall as its rows (it held room for eight); the count beside the
     title gives way to Stake / Unstake / Rewards (the rows say it) */
  #wk-mine .wk-tbl2{height:auto;min-height:0}
  #wk-mine .wk-t1 .wk-pn{display:none}
}
/* ════ ONE SCREEN (2026-09-29). Desktop (>=1100px): three fixed columns - YOU | the stage (the window,
   #well) | the PATHS. Phone: the paths are a bar at the foot, YOU's figures sit at the top of Your move.
   Everywhere: the paths replace the header's section tabs, Your move replaces the old Easy panels and the
   dashboard's view tabs and Easy|Pro switch give way (Pro is a path; Autopilot opens from its switch). ════ */
.one{display:contents}
#you,#paths{display:none}
#you,#paths,#mv-stage{--wc:#0e0e1d;--wh:#12122a;--wi:#0a0a16;--wbd:#232342;--wbd2:#34345c;--wt:#f0eef8;--ws:#c1bfdc;--wf:#8f8db4;
  --sv-teal:#2bc8bd;--sv-green:#2ee06a;--sv-amber:#ffb02e;--sv-violet:#b9b0ff;
  --wsans:"Helvetica Neue",Helvetica,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;--wmono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace}
.folder>.l1{display:none}
html[data-sec=dashboard] #calc .brandbar .l2host{display:none}
#one #sv-over>#sd-wstrip,#one #sv-over>.sd-grid{display:none!important}   /* .sd-strip carries display:grid !important */
html[data-svs=over] #one #sv-over{display:flex;flex-direction:column;padding:0;background:none;border:0;box-shadow:none}
#mv-stage{display:flex;flex-direction:column;gap:16px;flex:1 1 auto;min-height:0;border:1px solid var(--wbd);border-radius:14px;background:var(--wc);
  padding:20px 24px 18px;color:var(--wt);font-family:var(--wsans)}
.pth svg{display:none}
.pth .ps{display:none;font-style:normal}
.mv-you{display:none}
.you-h{display:flex;flex-direction:column;gap:6px;min-width:0}
.you-h h3{margin:0;font-size:17px;font-weight:600;color:var(--wt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.you-apr{display:flex;flex-direction:column;gap:3px}
.you-apr em,.you-hf>em,.you-hfh>em{font-style:normal;font-family:var(--wmono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf)}
.you-apr b{font-size:44px;font-weight:700;line-height:1.05;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--wt)}
.you-apr small{font-size:12.5px;color:var(--ws)}
.you-bal{display:flex;flex-direction:column;border-bottom:1px solid var(--wbd)}
.you-r{display:flex;align-items:center;gap:8px;min-height:40px;border-top:1px solid var(--wbd)}
.you-r span{flex:1 1 auto;font-size:13.5px;color:var(--ws)}
.you-r b{font-family:var(--wmono);font-size:15px;font-weight:500;color:var(--wt);font-variant-numeric:tabular-nums}
.you-r i{font-style:normal;width:52px;flex:0 0 auto;text-align:right;font-family:var(--wmono);font-size:10px;letter-spacing:.06em;color:var(--wf)}
.you-cl{height:24px;padding:0 9px;border:1px solid var(--sv-teal);border-radius:7px;background:transparent;color:var(--sv-teal);font:600 11.5px var(--wsans);cursor:pointer}
.you-sw{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--wbd);border-radius:11px;background:var(--wi)}
.you-swt{flex:1 1 auto;display:flex;flex-direction:column;gap:1px;min-width:0}
.you-swt b{font-size:14px;font-weight:600;color:var(--wt)}
.you-swt>b{display:flex;align-items:center;gap:7px}
.you-tag{font-style:normal;font-family:var(--wmono);font-size:9px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;line-height:1;
  padding:3px 6px;border-radius:999px;border:1px solid var(--wbd2);color:var(--wf)}
.you-tag.on{border-color:var(--sv-teal,#2bc8bd);color:var(--sv-teal,#2bc8bd);background:rgba(43,200,189,.10)}
.you-swt small{font-size:11.5px;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Hands-free: one ? for both services' rules (operator, 2026-09-30); the column clips, so the tip opens up and left */
.you-hfh{display:flex;align-items:center;justify-content:space-between;gap:8px}
.you-hfh .qm .qm-tip{width:250px;right:-4px;bottom:calc(100% + 8px)}
.you-hfh .qm-tip>b{display:block;margin:0 0 5px;font:600 12.5px/1.3 var(--wsans);color:var(--wt)}
.you-hfh .qm-tip>b~b{margin-top:10px}
.you-hfh .qm-tip>span{display:block;position:relative;margin:4px 0 0;padding-left:13px;font:400 12.5px/1.45 var(--wsans);color:var(--ws)}
.you-hfh .qm-tip>span::before{content:"";position:absolute;left:0;top:.55em;width:5px;height:5px;border-radius:50%;background:var(--sv-teal)}
.you-tg{width:44px;height:26px;flex:0 0 auto;border:0;border-radius:999px;padding:3px;background:var(--wbd2);display:flex;cursor:pointer}
.you-tg i{display:block;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .18s ease}
.you-tg.on{background:var(--sv-teal)}
.you-tg.on i{transform:translateX(18px)}
.you-tg:disabled{opacity:.45;cursor:default}
.you-fct{display:flex;flex-direction:column;gap:8px}
@media(min-width:1100px){#you .you-fct{margin-top:auto}#you .you-fct+.you-hf:not(#z){margin-top:16px}}   /* just above the hands-free switches */
.you-fct>em{font-style:normal;font-family:var(--wmono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf)}
.you-fct>em small{margin-left:6px;font-size:9px;letter-spacing:.06em;text-transform:none;color:var(--wf);opacity:.8}
.you-fb{display:flex;flex-direction:column;gap:8px}
.you-fw{position:relative;display:flex}
.you-fq{flex:1 1 auto;min-width:0;height:34px;padding:0 12px;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;box-sizing:border-box;border:1px solid var(--sv-teal,#2bc8bd);border-radius:9px;background:transparent;color:var(--sv-teal,#2bc8bd);
  font:600 11.5px var(--wsans);cursor:pointer;white-space:nowrap}
.you-fq:hover:not(:disabled){background:rgba(43,200,189,.10)}
.you-fq.sent{justify-content:space-between;background:rgba(43,200,189,.08)}
.you-fq.sent i{font-style:normal;font-family:var(--wmono);font-size:11px;font-weight:500;letter-spacing:.02em;min-width:0;overflow:hidden;text-overflow:ellipsis}
.you-fq:disabled{border-color:var(--wbd2);color:var(--wf);cursor:default}
.you-fct>small{font-size:11.5px;line-height:1.4;color:var(--ws)}
.you-fct>small a{color:var(--sv-teal,#2bc8bd)}
.you-fw[data-tip]:hover::after{content:attr(data-tip);position:absolute;left:0;bottom:calc(100% + 6px);z-index:4;padding:6px 10px;border-radius:8px;
  border:1px solid var(--wbd2);background:var(--wh);box-shadow:0 10px 24px -14px rgba(0,0,0,.6);font:600 12px var(--wsans);color:var(--wt);white-space:nowrap;pointer-events:none}
.you-sw[data-tip]{position:relative}
.you-sw[data-tip]:hover::after{content:attr(data-tip);position:absolute;right:10px;bottom:calc(100% + 6px);z-index:4;padding:6px 10px;border-radius:8px;
  border:1px solid var(--wbd2);background:var(--wh);box-shadow:0 10px 24px -14px rgba(0,0,0,.6);font:600 12px var(--wsans);color:var(--wt);white-space:nowrap;pointer-events:none}
.you-tg:focus-visible,.you-cl:focus-visible,.pth:focus-visible{outline:2px solid var(--sv-violet);outline-offset:2px}
@media(prefers-reduced-motion:reduce){.you-tg i{transition:none}}
.mv-top{display:flex;align-items:center;gap:10px}
.mv-top>em,.mv-box>em,.mv-sh em{font-style:normal;font-family:var(--wmono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf)}
.mv-top>em{flex:1 1 auto;padding-top:2px}
/* the stage's title as Pro's panes carry theirs: a coloured bar and a sans name */
.mv-h{display:inline-flex;align-items:center;gap:9px;margin:0 6px 0 0;font:700 16px/1.2 var(--wsans);letter-spacing:-.01em;color:var(--wt);white-space:nowrap}
.mv-h::before{content:"";width:3px;height:16px;border-radius:2px;background:var(--sv-teal);box-shadow:0 0 10px -1px var(--sv-teal)}
.mv-chip{font-family:var(--wmono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-radius:999px;white-space:nowrap}
.mv-chip.ok{background:rgba(43,200,189,.14);color:var(--sv-teal)}
.mv-chip.warn{background:rgba(255,176,46,.14);color:var(--sv-amber)}
.mv-chip.q{background:rgba(185,176,255,.14);color:var(--sv-violet)}
/* the headline, then one line: what it is on the left, the cooling-down note on the right (operator, 2026-09-30) */
.mv-hl{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:20px;row-gap:6px;align-items:baseline}
.mv-hl>b{grid-column:1/-1;font-size:40px;font-weight:700;line-height:1.05;letter-spacing:-.02em;color:var(--wt)}
.mv-hl>b.g,.mv-hl i.g{color:var(--sv-teal)}
.mv-hl i.a{color:var(--sv-amber)}
.mv-hl i{font-style:normal;font-weight:600}
.mv-hl>span{font-size:14.5px;line-height:1.45;color:var(--ws)}
.mv-hl>span b{color:var(--wt);font-weight:600}
.mv-flow{display:grid;grid-template-columns:minmax(0,1fr) 54px minmax(0,1fr);align-items:start;gap:0}
.mv-arr{align-self:center}
.mv-box{display:flex;flex-direction:column;border:1px solid var(--wbd);border-radius:12px;padding:12px 14px 8px;min-width:0}
.mv-box>em{margin-bottom:4px}
.mv-r{display:grid;grid-template-columns:44px minmax(0,1fr) auto 56px;align-items:baseline;gap:8px;padding:6px 0;border-top:1px solid var(--wbd)}
.mv-box>em+.mv-r{border-top:0}
.mv-r u{text-decoration:none;font-family:var(--wmono);font-size:11px}
.mv-r span{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--wt)}
.mv-r b{font-family:var(--wmono);font-size:13.5px;font-weight:500;text-align:right;color:var(--wt);font-variant-numeric:tabular-nums}
.mv-r i{font-style:normal;font-family:var(--wmono);font-size:11.5px;text-align:right}
.mv-r .a{color:var(--sv-amber)}.mv-r .g{color:var(--sv-teal)}
.mv-more{display:flex;align-items:center;gap:6px;width:100%;margin:0;padding:7px 0 3px;border:0;border-top:1px solid var(--wbd);background:none;
  font:inherit;font-size:12px;color:var(--ws);text-align:left;cursor:pointer}
.mv-more svg{width:13px;height:13px;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;transition:transform .18s ease}
.mv-more[aria-expanded=true] svg{transform:rotate(180deg)}
.mv-more:hover,.mv-more:focus-visible{color:var(--sv-teal);outline:none}
.mv-rows{display:flex;flex-direction:column}
.mv-rows>.mv-r:first-child{border-top:0}
.mv-rows .mv-x{display:none}
.mv-rows.open .mv-x{display:grid}
.mv-rows.open{max-height:210px;overflow-y:auto;scrollbar-width:thin;overscroll-behavior:contain}
@media(prefers-reduced-motion:reduce){.mv-more svg{transition:none}}
.mv-arr{display:flex;justify-content:center}
.mv-arr svg{width:40px;height:18px;fill:none;stroke:var(--sv-teal);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.mv-lock{font-size:12.5px;color:var(--sv-amber)}
.mv-hl>.mv-lock{grid-column:2;white-space:nowrap;text-align:right}
@media(max-width:700px){.mv-hl>.mv-lock{grid-column:1/-1;white-space:normal;text-align:left}}
/* 10,000 ATONE for a year, three ways: the largest validator, Autopilot, the smallest */
.mv-cmp{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.mv-cc{display:flex;flex-direction:column;gap:3px;min-width:0;padding:13px 16px 14px;border:1px solid var(--wbd);border-radius:12px}
.mv-cc em{font-style:normal;font-family:var(--wmono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf)}
.mv-cc small{font-size:12.5px;color:var(--ws);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-cc b{margin-top:6px;display:flex;align-items:baseline;gap:7px;font-size:24px;font-weight:700;letter-spacing:-.02em;color:var(--wt);font-variant-numeric:tabular-nums}
.mv-cc b i{font-style:normal;font-family:var(--wmono);font-size:10px;font-weight:400;letter-spacing:.06em;color:var(--wf)}
.mv-cc span{font-family:var(--wmono);font-size:12px;color:var(--ws)}
.mv-cc.g{border-color:var(--sv-teal);background:rgba(43,200,189,.08)}
.mv-cc.g b,.mv-cc.g span{color:var(--sv-teal)}
@media(max-width:700px){.mv-cmp{grid-template-columns:minmax(0,1fr);gap:8px}.mv-cc b{font-size:20px}}
.mv-set{display:flex;flex-direction:column;gap:6px;flex:1 1 auto;min-height:96px}
.mv-sh{display:flex;justify-content:space-between;gap:10px}
.mv-sh em.g{color:var(--sv-teal)}
.mv-bars{flex:1 1 auto;min-height:48px;display:flex;align-items:flex-end;gap:2px}
.mv-bars i{flex:1 1 0;min-width:0;border-radius:2px 2px 0 0;background:var(--wbd2)}
.mv-bars i.lo{background:rgba(43,200,189,.32)}
.mv-bars i.s{background:var(--sv-amber)}
.mv-bars i.d{background:var(--sv-teal)}
.mv-brk{display:flex;gap:2px}
.mv-brk span.g{border-top:2px solid var(--sv-teal);padding-top:4px;font-size:12px;text-align:center;color:var(--sv-teal)}
.mv-act{margin-top:auto;display:flex;align-items:center;justify-content:flex-end;gap:18px}
.mv-act>span{order:-1;margin-right:auto}   /* a note on the left, the button always on the right */
.mv-act>span{font-size:12.5px;line-height:1.45;color:var(--ws);max-width:44ch}
#mv-stage .mv-act .sd-go,#mv-stage .mv-go{width:auto;min-width:210px;height:50px;padding:0 26px;font-size:15px;flex:0 0 auto}
/* night: the stage's button is the cards' Activate - teal fill, dark text, no glow (the green glow read as a bigger button) */
#mv-stage .sv-btn.go.mv-go:not(#z){border-color:var(--sv-teal);background:var(--sv-teal);color:#0b1f1c;box-shadow:none;text-shadow:none}
#mv-stage .sv-btn.go.mv-go:not(#z):hover{filter:brightness(1.06)}
/* Autopilot is on: a statement, not a control (operator, 2026-09-30) - the switch in the You column turns it off */
#mv-stage .mv-on{flex:0 0 auto;font-size:15px;font-weight:600;color:var(--sv-teal)}
.mv-days{display:flex;flex-direction:column;gap:8px;border:1px solid var(--wbd);border-radius:12px;padding:14px 16px}
.mv-dh{display:flex;justify-content:space-between;font-size:13px;color:var(--ws)}
.mv-dh span:first-child{font-weight:600;color:var(--wt)}
.mv-dc{display:grid;grid-template-columns:repeat(21,minmax(0,1fr));gap:4px}
.mv-dc i{height:12px;border-radius:3px;background:var(--wbd)}
.mv-dc i.on{background:var(--sv-amber)}
.mv-days small{font-size:12px;color:var(--ws)}
.mv-ap{margin-top:auto;display:flex;align-items:center;gap:16px;padding:14px 16px;border-radius:12px;background:rgba(43,200,189,.10)}
.mv-ap>span{flex:1 1 auto;font-size:13.5px;line-height:1.45;color:var(--wt)}
#mv-stage .mv-ghost{flex:0 0 auto;height:42px;padding:0 18px;border:1px solid var(--sv-teal);background:transparent;color:var(--sv-teal)}
.mv-cyc{margin-top:auto;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.mv-cyc>div{display:flex;flex-direction:column;gap:3px;padding:11px 13px;border:1px solid var(--wbd);border-radius:11px}
.mv-cyc>div.done{background:rgba(43,200,189,.10);border-color:transparent}
.mv-cyc>div.warn{background:rgba(255,176,46,.10);border-color:transparent}
.mv-cyc em{font-style:normal;font-family:var(--wmono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--wf)}
.mv-cyc b{font-size:13.5px;font-weight:600;color:var(--wt)}
@media(min-width:1100px){
  .one{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:300px minmax(0,1fr) 256px;gap:18px;padding:18px 24px 22px}
  .one>.panes{padding:0;min-width:0}
  #you,#paths{display:flex;flex-direction:column;min-height:0;font-family:var(--wsans);color:var(--wt)}
  #you{border:1px solid var(--wbd);border-radius:14px;background:var(--wc);padding:18px 18px 16px;gap:18px;overflow:hidden}
  .you-hf{margin-top:auto;display:flex;flex-direction:column;gap:8px}
  #paths{gap:10px}
  .pth{flex:1 1 0;min-height:0;display:flex;flex-direction:column;gap:4px;text-align:left;padding:13px 15px;border:1px solid var(--wbd);border-radius:14px;
    background:var(--wc);color:var(--wt);font:inherit;cursor:pointer;overflow:hidden}
  .pth em{font-style:normal;font-family:var(--wmono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--wf)}
  .pth b{font-size:16px;font-weight:600;line-height:1.25;color:var(--wt)}
  .pth small{font-size:12.5px;line-height:1.35;color:var(--ws);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .pth:hover{border-color:var(--wbd2)}
  .pth.on{border-color:var(--sv-teal);box-shadow:inset 0 0 0 1px var(--sv-teal);background:linear-gradient(180deg,rgba(43,200,189,.12),var(--wc) 70%)}
  /* Pro stays as it was: it gets the You column's width (it carries its own balance strip) */
  html:is([data-sv="dashboard/self"],[data-sv="dashboard/autopilot"]) .one{grid-template-columns:minmax(0,1fr) 256px}
  html:is([data-sv="dashboard/self"],[data-sv="dashboard/autopilot"]) #you{display:none}
  /* the stage fills its column: these screens were pinned to the calculator's height (--calc-h) so the
     dashboard matched the calculator window; on the one screen there is no calculator beside them */
  html[data-tab=dele] #one .w#calc>#sv,html[data-tab=dele] #one .w#calc>#p-dele,
  html[data-tab=empty] #one .w#calc>#p-empty,html[data-tab=connect] #one .w#calc>#p-connect{flex:1 1 auto;height:auto;max-height:none}
  html[data-svs=over] #one #sv-over{overflow:hidden}
  #mv-stage{overflow:hidden}
  /* the chart is the stage's give: it shrinks first, so the action never leaves the screen */
  .mv-set{flex:1 1 0;min-height:0}
  .mv-bars{min-height:0}
}
/* ════ PRO ON THE ONE SCREEN (2026-09-30, operator: "redesign pro as rest of the theme"). The same cards, type
   and controls as Your move and the paths: no frame around the panes, one card each, the balances as plain
   figures, sans text with mono only for labels and numbers. The Pro titles (a coloured bar and a sans name)
   stay: Your move took them. ════ */
#one #p-dele #wbody:not(#z){border:0;background:none;box-shadow:none;padding:0;gap:14px}
#one #p-dele .wk-two{gap:14px}
@media(min-width:1100px){#one #p-dele .wk-two:not(#z){grid-template-columns:minmax(0,1.2fr) minmax(0,1.75fr) minmax(0,1fr)}}
#one #p-dele .wk-pane:not(#z),#one #p-dele #sd-mstrip.sd-strip:not(#z){border:1px solid var(--wbd);border-radius:14px;background:var(--wc);box-shadow:none}
#one #p-dele .wk-pane:not(#z){padding:14px 18px 16px}
#one #p-dele .wk-pane>.wk-ph{margin-bottom:8px}
/* the balances: the name, then five plain figures under small labels, as the You column shows them */
#one #p-dele #sd-mstrip .sd-idw:not(#z){padding:16px 20px}
#one #p-dele #sd-mstrip .sd-ro:not(#z){padding:14px 20px;gap:6px;justify-content:center;border-left:1px solid var(--wbd)}
#one #p-dele #sd-mstrip .sd-ro em:not(#z){margin:0;font-size:10px;letter-spacing:.16em;color:var(--wf)}
#one #p-dele #sd-mstrip .sd-ro em::before{display:none}
#one #p-dele #sd-mstrip .sd-ro .sd-well:not(#z){flex:0 0 auto;min-height:0;margin:0;padding:0;border:0;border-radius:0;background:none;box-shadow:none;align-items:baseline;gap:7px}
#one #p-dele #sd-mstrip .sd-well>b{font-size:26px;font-weight:700;line-height:1.1}
#one #p-dele #sd-mstrip .sd-well>i.u{margin:0;font-size:10px;letter-spacing:.06em}
#one #p-dele #sd-mstrip .sd-well>.sd-m{display:none}
/* tables: a label row over hairlines, names in the sans, figures in the mono */
#one #p-dele .wk-tbl2 th:not(#z){height:26px;padding:0 6px;border:0;border-bottom:1px solid var(--wbd);background:none;box-shadow:none;
  font-family:var(--wmono);font-size:9px;letter-spacing:.1em;color:var(--wf);vertical-align:middle}
#one #p-dele .wk-tbl2 thead:not(#z),#one #p-dele .wk-tbl2 thead tr:not(#z){border:0;background:none;box-shadow:none;outline:0}
#one #p-dele .wk-tbl2 td:not(#z){border-bottom:1px solid var(--wbd)}
#one #p-dele .wk-tbl2 td.nm:not(#z){font-family:var(--wsans);font-size:13.5px;font-weight:500;color:var(--wt)}
#one #p-dele .wk-tbl2 td.amt:not(#z){color:var(--wt)}
/* Delegations: its three actions sit on their own line under the title, as small outlined buttons */
#one #p-dele #wk-mine .wk-t1:not(#z){flex-wrap:wrap;height:auto;max-height:none;row-gap:10px;column-gap:8px}
#one #p-dele #wk-mine .wk-t1::after{content:"";flex:0 0 100%;order:1}
#one #p-dele #wk-mine .wk-t1 .wk-unb:not(#z){order:2;flex:1 1 0;min-width:0;margin:0;height:28px;padding:0 8px;border-radius:8px;border:1px solid var(--wcyan);background:transparent;
  color:var(--wcyan);font:600 12px var(--wsans);letter-spacing:0;text-transform:none;box-shadow:none}
#one #p-dele #wk-mine .wk-t1 #unbtn:not(#z){border-color:var(--wamber);color:var(--wamber)}
#one #p-dele #wk-mine .wk-t1 .wk-unb[hidden]{display:none}
/* Redelegate: the amount field as the app's other fields */
#one #p-dele #wk-plan .wk-field:not(#z){height:32px;border:1px solid var(--wbd2);border-radius:10px;background:var(--wi);box-shadow:none}
#one #p-dele #wk-plan .wk-amt2:not(#z){font:500 13px var(--wmono);color:var(--wt)}
#one #p-dele #wk-plan .wk-max:not(#z){border-radius:7px;font:500 10.5px var(--wmono)}
/* Outcome: the three figures as the stage's small boxes, the empty note in words, the button as Your move's */
#one #p-dele .wk-ans .p:not(#z){border:1px solid var(--wbd);border-radius:10px;background:none;box-shadow:none}
#one #p-dele .wk-ans .p::before{display:none}
#one #p-dele #wk-mv .wk-ans:not(#z){display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
#one #p-dele #wk-mv .wk-ans .p:not(#z){height:auto;min-height:40px;padding:6px 10px;flex-wrap:wrap}
#one #p-dele #wk-mv .wk-ans .p.rate:not(#z){grid-column:1/-1}
/* Delegations has the room: its amount and APR columns stop cutting their figures */
#one #p-dele #dmy col:nth-child(4){width:92px!important}
#one #p-dele #dmy col:nth-child(5){width:62px!important}
#one #p-dele #wk-mv .wk-moves th:not(#z){border:0;border-bottom:1px solid var(--wbd);background:none;box-shadow:none;color:var(--wf)}
#one #p-dele #wk-mv .wk-moves thead:not(#z),#one #p-dele #wk-mv .wk-moves thead tr:not(#z),#one #p-dele #wk-mv .wk-moves:not(#z){border:0;background:none;box-shadow:none}
#one #p-dele .wk-mvempty:not(#z){font:400 13px/1.45 var(--wsans);letter-spacing:0;text-transform:none;color:var(--ws)}
#one #p-dele #dgo:not(#z){height:46px;border-radius:12px;border:1px solid var(--wcyan);background:var(--wcyan);color:var(--wc);
  font:600 15px var(--wsans);letter-spacing:0;text-transform:none;box-shadow:none}
#one #p-dele #dgo:disabled:not(#z){border-color:var(--wbd2);background:transparent;color:var(--wf)}
@media(max-height:700px){#one #p-dele #dgo:not(#z){height:34px;font-size:14px}}
.txap{margin:0 0 10px;padding:10px 12px;border-radius:10px;background:rgba(43,200,189,.10);font-size:12.5px;line-height:1.45;color:var(--wt)}
.txap b{color:var(--wcyan);font-weight:600}
/* the Autopilot and Restake cards: three short lines, each with a small ? that holds the detail (hover, or tap
   on a phone), and a Rules pill in the header - no paragraphs in front (operator, 2026-09-30) */
#rspop .txcard{--wc:#0e0e1d;--wh:#16162a;--wbd:#2a2a4a;--wbd2:#3e3e66;--wi:#0b0b19;--wt:#f0eef8;--ws:#c1bfdc;--wf:#8f8db4;--wcyan:#2bc8bd;--wamber:#ffb02e;
  --wsans:"Helvetica Neue",Helvetica,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;--wmono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace}
#atpop .card.atcard{width:min(460px,94vw);height:auto;max-height:94vh}
#atpop .atL{padding:6px 20px 4px}
.rscard{width:min(460px,94vw)}
.rsbody{padding:6px 20px 4px}
.rsfoot{display:flex;justify-content:flex-end;gap:10px;padding:12px 20px 16px;border-top:1px solid var(--wbd)}
.bn{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.bn li{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px 0;border-top:1px solid var(--wbd)}
.bn li:first-child{border-top:0}
.bn-ic{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:rgba(43,200,189,.12)}
.bn-ic svg{width:17px;height:17px;fill:none;stroke:var(--wcyan);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.bn-t{display:flex;flex-direction:column;gap:2px;min-width:0}
.bn-t>b{font-size:14px;font-weight:600;color:var(--wt)}
.bn-t small{font-size:12px;color:var(--ws)}
.bn-t small b{color:var(--wt);font-weight:600}
.qm{position:relative;flex:0 0 auto;width:22px;height:22px;padding:0;border:1px solid var(--wbd2);border-radius:50%;background:transparent;color:var(--ws);
  font:600 11px var(--wmono);line-height:20px;text-align:center;cursor:help}
.qm-r{order:2;margin:0 0 0 12px}
.qm:hover,.qm:focus-visible{border-color:var(--wcyan);color:var(--wt);outline:none}
.qm-tip{display:none;position:absolute;right:-6px;bottom:calc(100% + 10px);z-index:5;width:min(280px,76vw);padding:11px 13px;border:1px solid var(--wbd2);border-radius:11px;
  background:var(--wh);box-shadow:0 18px 40px -18px rgba(0,0,0,.55);font:400 12.5px/1.5 var(--wsans);letter-spacing:0;text-align:left;text-transform:none;color:var(--wt);white-space:normal;cursor:default}
.qm-r .qm-tip{bottom:auto;top:calc(100% + 10px)}
.qm:hover .qm-tip,.qm.open .qm-tip{display:block}
/* the card header sets display:block on every span: its tip hides and shows at that header's own specificity */
.wk-txh .qm .qm-tip,.txcard .wk-txh .qm .qm-tip{display:none}
.wk-txh .qm:hover .qm-tip,.wk-txh .qm.open .qm-tip,.txcard .wk-txh .qm:hover .qm-tip,.txcard .wk-txh .qm.open .qm-tip{display:block}
/* in a card's header the tip must not take the header's small mono lettering */
.wk-txh .qm .qm-tip,.txcard .wk-txh .qm .qm-tip{font:400 12.5px/1.5 var(--wsans);letter-spacing:0;text-transform:none;color:var(--wt)}
.wk-txh .qm-r,.txcard .wk-txh .qm-r{font:600 11px/20px var(--wmono);letter-spacing:0;text-transform:none;color:var(--ws)}
.wk-txh .qm-r .qm-tip{width:min(300px,80vw)}
/* the header's own b and span rules reach into the tip: its title and lines are set here, above them */
.txcard .wk-txh .qm-r .qm-tip>b,.uncard .wk-txh .qm-r .qm-tip>b{display:block;margin:0 0 7px;font:600 12.5px/1.3 var(--wsans);letter-spacing:0;color:var(--wt)}
.txcard .wk-txh .qm-r .qm-tip>span{display:block;position:relative;margin:5px 0 0;padding-left:13px;font:400 12.5px/1.45 var(--wsans);letter-spacing:0;text-transform:none;color:var(--ws)}
.txcard .wk-txh .qm-r .qm-tip>span::before{content:"";position:absolute;left:0;top:.55em;width:5px;height:5px;border-radius:50%;background:var(--wcyan)}
#rsgo{min-width:180px;height:40px;border-color:var(--wcyan);background:var(--wcyan);color:#0b1f1c;font-weight:600}
#rsgo.wk-danger{background:transparent;border-color:#ff6a6a;color:#ff6a6a}
#atpop .atnote{margin:4px 0 8px}
/* Autopilot and Restake read alike (operator, 2026-09-30): title and an Active/Inactive tag, three lines, the
   12-hour note, one button. Autopilot's status boxes are not shown */
#atpop #atstate{display:none!important}
#rspop .atnote:not(#z){margin:14px 0 8px;padding:10px 12px;font-size:12px;border-radius:9px}
/* one frame for both: width, insets, header, and a footer with the button on the right at one size */
#atpop .card.atcard:not(#z),#rspop .card.rscard:not(#z){width:min(520px,94vw);max-width:520px;padding:0}
#atpop .atcard>.wk-txh:not(#z),#rspop .rscard>.wk-txh:not(#z){padding:16px 20px 12px}
#atpop .atL:not(#z),#rspop .rsbody:not(#z){padding:6px 20px 4px}
#atpop .atnote:not(#z){margin:14px 0 8px}
#atpop .atcard .atfoot:not(#z){display:flex;flex-direction:row;align-items:center;justify-content:flex-end;gap:12px;padding:12px 20px 16px}
#atpop .atcard .atfoot .atfs:not(#z){padding:0;margin-right:auto}
#atpop .atcard .atfoot .txbtns:not(#z){justify-content:flex-end;margin:0}
#rspop .rsfoot:not(#z){padding:12px 20px 16px}
#atpop .atfoot .txbtns .wk-btn:not(#z),#rspop #rsgo:not(#z){min-width:180px;height:40px;border-radius:10px;font:600 13px var(--wsans);letter-spacing:.02em;text-transform:none}
#atpop #atgrant:not(#z){border-color:var(--wcyan);background:var(--wcyan);color:#0b1f1c}
#atpop #atgrant:disabled:not(#z){border-color:var(--wbd2);background:transparent;color:var(--wf)}
#atpop #atrevoke:not(#z),#rspop #rsgo.wk-danger:not(#z){background:transparent;border-color:#ff6a6a;color:#ff6a6a}
.txcard .wk-txh .txsum .you-tag{display:inline-block;font-size:9px;letter-spacing:.08em}
/* Autopilot has no choices left (no cap, no validator list): the card is what it does, and Grant / Revoke */
#atpop .atview,#atpop #atR,#atpop #atform{display:none!important}
#atpop .atbody{grid-template-columns:minmax(0,1fr)!important;flex:0 0 auto!important;min-height:0!important}
#atpop .card.atcard:not(#z){height:auto!important;min-height:0!important}
#atpop .atcard,#atpop .card.atcard{max-width:560px}
.atwhat{display:flex;flex-direction:column;gap:10px;margin:4px 0 12px}
.atwhat>div{display:flex;flex-direction:column;gap:3px;padding:11px 13px;border:1px solid var(--wbd);border-radius:10px}
.atwhat b{font-size:14px;font-weight:600;color:var(--wt)}
.atwhat span{font-size:12.5px;line-height:1.45;color:var(--ws)}
/* a laptop width: the side columns give the stage a little more, and the economics price row sits tighter */
@media(min-width:1100px) and (max-width:1599px){
  .one{grid-template-columns:272px minmax(0,1fr) 232px;gap:14px;padding-left:18px;padding-right:18px}
  html:is([data-sv="dashboard/self"],[data-sv="dashboard/autopilot"]) .one{grid-template-columns:minmax(0,1fr) 232px}
  #sv-eco .sv-tp{margin-left:12px;padding-left:12px;gap:8px}
  #sv-eco .sv-trole{margin-left:8px}
}
/* the paths as icons with their short names, as the phone's bar does: the old Autopilot screen below 1600px (Pro
   keeps the full rail, operator 2026-09-30: "keep it consistent") and a rail the reader folded (html[data-railc]) */
@media(min-width:1100px) and (max-width:1599px){
  html[data-sv="dashboard/autopilot"] .one{grid-template-columns:minmax(0,1fr) 78px}
}
@media(min-width:1100px) and (max-width:1599px){
  html:is([data-sv="dashboard/autopilot"]) .pth{align-items:center;justify-content:center;gap:5px;padding:8px 4px;text-align:center}
  html[data-sv="dashboard/autopilot"] .pth em,
  html[data-sv="dashboard/autopilot"] .pth b,
  html[data-sv="dashboard/autopilot"] .pth small{display:none}
  html[data-sv="dashboard/autopilot"] .pth .ps{display:block;font-size:10.5px;color:var(--ws);max-width:100%;overflow:hidden;text-overflow:ellipsis}
  html[data-sv="dashboard/autopilot"] .pth svg{display:block;width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;color:var(--ws)}
  html[data-sv="dashboard/autopilot"] .pth.on svg,html[data-sv="dashboard/autopilot"] .pth.on .ps{color:var(--sv-teal)}
}
/* Pro has Easy's structure (operator, 2026-09-30: "pro is still the same, its wallet structure and all"): the You
   column on the left holds the wallet, as on every path, and the old balance strip goes. The stage holds the pick
   list as the main pane, with Delegations over Outcome beside it. Below 1600px the paths fold to icons, as before. */
@media(min-width:1100px){
  html[data-sv="dashboard/self"] #one.one{grid-template-columns:300px minmax(0,1fr) 256px}
  html[data-sv="dashboard/self"] #one #you{display:flex}
  #one #p-dele #sd-mstrip{display:none!important}
  #one #p-dele .wk-two:not(#z){grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr);align-items:stretch}
  #one #p-dele #wk-plan:not(#z){grid-column:1;grid-row:1/3}
  #one #p-dele #wk-mine:not(#z){grid-column:2;grid-row:1}
  #one #p-dele #wk-mv:not(#z){grid-column:2;grid-row:2}
  #one #p-dele .wk-two>.wk-pane:not(#z){min-height:0;flex:none}
}
@media(min-width:1100px) and (max-width:1599px){
  html[data-sv="dashboard/self"] #one.one{grid-template-columns:272px minmax(0,1fr) 232px}
  /* the lock chip keeps its lock and its amount; the words and the date stay in its tooltip */
  #one #p-dele #wk-plan>.wk-ph .wk-lockn .w,#one #p-dele #wk-plan>.wk-ph .wk-lockn .w2,#one #p-dele #wk-plan>.wk-ph .wk-lockn b:last-of-type{display:none}
  #one #p-dele #wk-plan>.wk-ph .wk-lockn:not(#z){flex:0 0 auto;max-width:none;overflow:visible}
}
/* a narrower laptop: the side column takes a little more, so Delegations keeps its names */
@media(min-width:1100px) and (max-width:1599px){
  #one #p-dele .wk-two:not(#z){grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)}
  #one #p-dele #dmy col:nth-child(4){width:84px!important}
  #one #p-dele #dmy col:nth-child(6){width:50px!important}
  #one #p-dele #wk-plan>.wk-ph .wk-lockn b{display:none}         /* the lock alone; its amount is in the tooltip */
  #one #p-dele #wk-plan .wk-field:not(#z){flex:1 1 150px;min-width:0;max-width:180px}
}
@media(min-width:1100px){#one #p-dele #dmy col:nth-child(2){width:40px!important}}
/* a short screen: Outcome keeps the room its figures and button need, Delegations gives (its list scrolls) */
@media(min-width:1100px) and (max-height:820px){
  #one #p-dele .wk-two:not(#z){grid-template-rows:minmax(150px,1fr) 294px}
  #one #p-dele #wk-mv .wk-ans .p:not(#z){min-height:34px;padding:4px 10px}
  #one #p-dele #wk-mv .wk-mvempty:not(#z){display:none}
  #one #p-dele #dgo:not(#z){height:38px;font-size:14px}
}
@media(min-width:1100px) and (max-height:660px){
  #one #p-dele .wk-two:not(#z){grid-template-rows:minmax(100px,1fr) 240px}
  #one #p-dele .wk-pane:not(#z){padding:10px 16px 12px}
  #one #p-dele #wk-mv .wk-ans .p:not(#z){min-height:30px;padding:3px 10px}
  #one #p-dele #dgo:not(#z){height:34px}
}
/* ════ FLAT PANELS (operator, 2026-09-30): the figure strips on top of the governance tabs read as the wallet column
   does, laid out sideways - one flat panel, sections split by hairlines, a small label, the figure plain (no well), a
   short note. Tighter than the boxes they replace, so the tab's body gets the room. ════ */
#one .gv-strip:not(#z),#one #sd-gstrip.sd-strip:not(#z){border:1px solid var(--wbd);border-radius:14px;background:var(--wc);box-shadow:none}
#one .gv-strip .gv-ro:not(#z),#one #sd-gstrip .sd-ro:not(#z){padding:12px 20px 13px;gap:5px;justify-content:flex-start;background:none;border-left:1px solid var(--wbd)}
#one .gv-strip .gv-ro:first-child,#one #sd-gstrip>:first-child{border-left:0}
#one .gv-strip .gv-ro em:not(#z),#one #sd-gstrip .sd-ro em:not(#z){margin:0;font-size:10px;letter-spacing:.16em;color:var(--wf)}
#one .gv-strip .gv-ro em::before,#one #sd-gstrip .sd-ro em::before{display:none}
#one .gv-strip .gv-ro .sd-well:not(#z),#one #sd-gstrip .sd-ro .sd-well:not(#z){flex:0 0 auto;min-height:0;margin:0;padding:0;border:0;border-radius:0;background:none;box-shadow:none;align-items:baseline;gap:7px}
#one .gv-strip .gv-ro .sd-well>b:not(#z),#one #sd-gstrip .sd-well>b:not(#z){font-size:24px;font-weight:700;line-height:1.1;letter-spacing:-.02em}
#one .gv-strip .gv-ro .sd-well>i:not(#z),#one #sd-gstrip .sd-well>i:not(#z){margin:0;font-size:10px;letter-spacing:.06em}
#one .gv-strip .gv-ro .sd-well>.sd-m,#one #sd-gstrip .sd-well>.sd-m{display:none}
#one .gv-strip .gv-ro small:not(#z){margin:0;font-size:12px;line-height:1.35;color:var(--ws);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* Your governor: the wallet's name is in the wallet column (and the header), so its strip keeps only the figures */
#one #sd-gstrip.sd-strip:not(#z){grid-template-columns:repeat(5,minmax(0,1fr))!important}
#one #sd-gstrip>.sd-id:not(#z){display:none}
#one #sd-gstrip>.sd-ro:nth-child(2){border-left:0}
#one #sd-gstrip .sd-ro em:not(#z){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* ════ PICKS (operator, 2026-09-30): the three tables list every validator and fill the stage's height, each
   scrolling in its own card under a header that stays; nothing below them is left empty ════ */
@media(min-width:1100px){
  html[data-tab=pays] #one .w#calc>#p-pays{flex:1 1 auto;height:auto;max-height:none;min-height:0}
  #one #p-pays>.pw:not(#z){height:100%;display:flex;flex-direction:column;min-height:0}
  #one #p-pays .duotab:not(#z){flex:1 1 auto;min-height:0;height:auto;grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch;gap:14px}
  #one #p-pays .duotab>div:not(#z){min-height:0;min-width:0;display:flex;flex-direction:column;border-radius:14px;padding:12px 14px 6px}
  #one #p-pays .duotab .ptw:not(#z){flex:1 1 0;min-height:0;overflow-y:auto;overflow-x:hidden}
  #one #p-pays .ptab:not(#z){width:100%}
  #one #p-pays .ptab thead th{position:sticky;top:0;z-index:1;background:var(--card,#09090f)}
  #one #p-pays .ptab td.nm span{display:inline-block;max-width:13ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle}
  /* a narrow card keeps rank, name and its own figure; the rest come back when there is room (folded sides, a
     wide screen) */
  #one #p-pays .duotab>div{container-type:inline-size;container-name:pick}
}
@container pick (max-width:430px){
  #one #p-pays .ptab th:nth-child(n+4),#one #p-pays .ptab td:nth-child(n+4){display:none}
  #one #p-pays .ptab:not(#z){table-layout:fixed}
  #one #p-pays .ptab th:nth-child(1){width:34px}
  #one #p-pays .ptab th:nth-child(3){width:78px}
  #one #p-pays .ptab td.nm span{max-width:calc(100% - 26px)}
}
/* ════ PRO AS A WORKSPACE (operator, 2026-09-30): on a wide screen the wallet column holds your delegations and
   the menu - Redelegate, Stake, Unstake, Claim; the main pane loads the chosen action's list and Outcome its figures
   and button (app.js dock()). The hands-free switches stay on the other paths. ════ */
#rdbtn{display:none}
/* the actions are tabs in the title bar now; the wallet column keeps only the list of your delegations */
.protabs{display:none}
@media(min-width:1100px){
  html[data-sv="dashboard/self"] .brandbar .protabs:not(#z){display:flex;margin-left:auto;grid-column:2/-1;justify-self:end}
  #you #wk-mine .wk-t1 .wk-unb{display:none!important}
  #protabs .l2tab[aria-selected=true]{background:var(--ink);color:var(--void);font-weight:500}
  #protabs .l2tab[aria-disabled=true]{color:var(--l2-off);cursor:not-allowed}
  /* Outcome's breakdown */
  #one #proout .pro-brk{display:flex;flex-direction:column;gap:8px;order:-1}
  .pro-brk-t{width:100%;border-collapse:collapse;table-layout:fixed;font-variant-numeric:tabular-nums}
  .pro-brk-t th{height:24px;padding:0 6px;text-align:right;border-bottom:1px solid var(--wbd);font:400 9px var(--wmono);letter-spacing:.1em;text-transform:uppercase;color:var(--wf)}
  .pro-brk-t th.l{text-align:left}
  .pro-brk-t td{height:30px;padding:0 6px;text-align:right;border-bottom:1px solid var(--wbd);font:500 12px var(--wmono);color:var(--wt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pro-brk-t td.nm{text-align:left;font:500 13px var(--wsans)}
  .pro-brk-t td.nm .wk-lg{width:16px;height:16px;margin-right:7px;vertical-align:middle}
  .pro-brk-t td.nm span{vertical-align:middle}
  .pro-brk-t th:first-child{width:40%}
  .pro-brk-f{font-size:12.5px;line-height:1.45;color:var(--ws)}
  .pro-brk-f b{color:var(--wcyan);font-weight:600}
  .pro-brk-e{padding:24px 0;text-align:center;font-size:13px;color:var(--ws)}
  /* the old one-line sum is the breakdown's footer now */
  #one #proout .txsum{display:none}
}
@media(min-width:1100px){
  html[data-sv="dashboard/self"] #rdbtn:not(#z){display:inline-flex}
  #one #p-dele .wk-two.wk-two:not(#z){grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr)}
  #one #p-dele #wk-plan.wk-pane:not(#z){grid-column:1;grid-row:1}
  #one #p-dele #wk-mv.wk-pane:not(#z){grid-column:2;grid-row:1}
  /* Outcome keeps its button at the foot: the moves list takes the room between and scrolls, the button never moves */
  #one #p-dele #wk-mv.wk-pane:not(#z){display:flex;flex-direction:column;min-height:0;overflow:hidden}
  #one #p-dele #wk-mv .wk-moves:not(#z){flex:1 1 auto;min-height:0;overflow-y:auto}
  #one #p-dele #wk-mv .wk-mvempty:not(#z){flex:1 1 auto}
  #one #p-dele #wk-mv #dgo:not(#z){flex:0 0 auto;margin-top:auto}
  /* the Delegations pane inside the wallet column */
  #you .you-dele{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;border-top:1px solid var(--wbd);padding-top:12px}
  #you #wk-mine.wk-pane:not(#z){flex:1 1 auto;min-height:0;display:flex;flex-direction:column;border:0;border-radius:0;background:none;box-shadow:none;padding:0;overflow:hidden}
  #you #wk-acct{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}
  /* the menu, 2 by 2, above your delegations; the pane's title after it */
  #you #wk-mine .wk-t1.wk-ph:not(#z){display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;height:auto;max-height:none;margin:0 0 12px;padding:0}
  #you #wk-mine .wk-t1::after{display:none}
  #you #wk-mine .wk-t1 .wk-unb:not(#z){order:0;display:inline-flex;align-items:center;justify-content:center;width:auto;height:32px;margin:0;padding:0 8px;
    border-radius:9px;border:1px solid var(--wbd2);background:transparent;color:var(--wt);font:600 12.5px var(--wsans);letter-spacing:0;text-transform:none;box-shadow:none}
  #you #wk-mine .wk-t1 .wk-unb:not(#z):hover{border-color:var(--wcyan);color:var(--wcyan)}
  #you #wk-mine .wk-t1 h3:not(#z){order:5;grid-column:1/-1;margin:10px 0 0;font:700 14px/1.2 var(--wsans);color:var(--wt)}
  #you #wk-mine .wk-t1 .wk-pn,#you #wk-mine .wk-t1 .wk-foot{display:none}
  #you .wk-tbl2 th:not(#z){height:24px;padding:0 5px;border:0;border-bottom:1px solid var(--wbd);background:none;box-shadow:none;font-family:var(--wmono);font-size:9px;letter-spacing:.1em;color:var(--wf)}
  #you .wk-tbl2 thead:not(#z),#you .wk-tbl2 thead tr:not(#z){border:0;background:none;box-shadow:none;outline:0}
  #you .wk-tbl2 td:not(#z){padding:0 5px;border-bottom:1px solid var(--wbd)}
  #you .wk-tbl2 td.nm:not(#z){font-family:var(--wsans);font-weight:500;color:var(--wt)}
  #you #dmy:not(#z){flex:1 1 auto;min-height:0;overflow-y:auto}
  #you #dmy col:nth-child(6),#you #dmy th:nth-child(6),#you #dmy td:nth-child(6),
  #you #dmy col:nth-child(2),#you #dmy th:nth-child(2),#you #dmy td:nth-child(2){display:none}   /* rewards and rank: the column is narrow */
  #you #dmy col:nth-child(1){width:26px!important}
  #you #dmy col:nth-child(2){width:24px!important}
  #you #dmy col:nth-child(4){width:66px!important}
  #you #dmy col:nth-child(5){width:54px!important}
  #you #dmy td.nm:not(#z){font-size:12.5px}
  /* the menu shows where you are */
  html[data-sv="dashboard/self"]:not([data-pro]) #you #wk-mine .wk-t1 #rdbtn:not(#z),html[data-pro=stake] #you #wk-mine .wk-t1 #stbtn:not(#z),
  html[data-pro=unstake] #you #wk-mine .wk-t1 #unbtn:not(#z),html[data-pro=claim] #you #wk-mine .wk-t1 #clbtn:not(#z){background:var(--wcyan);border-color:var(--wcyan);color:var(--wc)}
  /* an action docked: the Redelegate list and its outcome step aside for the action's own parts */
  html[data-pro] #wk-plan>.wk-ph>:not(h3):not(#prohdr){display:none!important}
  html[data-pro] #wk-plan>#dpicks{display:none}
  html[data-pro] #wk-mv>:not(.wk-ph):not(#proout){display:none!important}
  html[data-pro] #wk-mv #dmvn{display:none}
  #one .pro-dock:not(#z){width:auto;max-width:none;height:auto;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:none;box-shadow:none;animation:none;transform:none}
  #one #prolist:not(#z){flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:12px;overflow-y:auto}
  #one #proout:not(#z){flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:10px;overflow-y:auto}
  #one #proout .txsum:not(#z){margin:0;text-align:left;font-size:12px}
  #one #proout .txbtns:not(#z){order:3;margin-top:auto;padding:0;border:0;justify-content:stretch}
  /* the lock note sits at the foot, just above the button; the fee line stays under the breakdown */
  #one #proout .txlock:not(#z){order:2;margin:auto 0 0;width:auto;max-width:none;align-self:stretch}
  #one #proout .txlock:not(:empty) ~ .txbtns:not(#z){margin-top:0}
  #one #proout .txbtns .wk-btn.wk-go:not(#z){flex:1 1 auto;height:46px;border-radius:12px;border:1px solid var(--wcyan);background:var(--wcyan);color:var(--wc);
    font:600 15px var(--wsans);letter-spacing:0;text-transform:none}
  #one #proout .txbtns .wk-btn.wk-go:disabled:not(#z){border-color:var(--wbd2);background:transparent;color:var(--wf)}
  #one #proout .txbtns #uncancel,#one #proout .txbtns .wk-bell{display:none!important}
  /* every action's button is Redelegate's: full width, the same height, radius, type and fill */
  #one #proout .txbtns .wk-btn.wk-go:not(#z):not(#y),#one #p-dele #wk-mv #dgo:not(#z):not(#y){width:100%;flex:1 1 auto;height:46px;margin:0;padding:0 20px;border-radius:12px;
    border:1px solid var(--wcyan);background:var(--wcyan);color:var(--wc);font:600 15px var(--wsans);letter-spacing:0;text-transform:none;box-shadow:none}
  #one #proout .txbtns .wk-btn.wk-go:disabled:not(#z):not(#y),#one #p-dele #wk-mv #dgo:disabled:not(#z):not(#y){border-color:var(--wbd2);background:transparent;color:var(--wf)}
  #one #p-dele #wk-mv #dgo:not(#z):not(#y){flex:0 0 auto;margin-top:auto}
  /* the card's lists were sized for a card: here they take the pane's height */
  #one #prolist .unpick:not(#z),#one #prolist .stlist:not(#z){flex:1 1 auto;min-height:0;max-height:none;overflow-y:auto}
  #one #proout .txlock:not(#z){display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:10px;font:400 12.5px/1.45 var(--wsans);letter-spacing:0}
  #one #proout .txlock svg:not(#z){flex:0 0 auto;width:15px;height:15px;margin-top:2px}
  #one #proout .txlock:empty,#one #proout .txfee:empty,#one #proout .txstep:empty{display:none}
}
/* ════ PRO ACTIONS AS REDELEGATE (operator, 2026-09-30: "copy pixel fit redelegate"): the amount field in the title
   row at Redelegate's place and size, the lists as Redelegate's table - a titles row, 32px rows on hairlines, the
   name in the sans, figures in the mono - so switching tabs moves nothing ════ */
#prohdr{display:none}
@media(min-width:1100px){
  html[data-pro] #one #prohdr:not(#z){display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;margin:0 0 0 14px;padding:0;border:0;background:none;box-shadow:none;width:auto;max-width:none}
  #one #prohdr .sttop:not(#z),#one #prohdr .unamt:not(#z){display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;margin:0;padding:0;border:0}
  #one #prohdr .wk-field:not(#z):not(#y){flex:0 1 180px;min-width:0;max-width:180px;height:32px;margin:0;border:1px solid var(--wbd2);border-radius:10px;background:var(--wi);box-shadow:none}
  #one #prohdr .wk-amt2:not(#z){font:500 13px var(--wmono);color:var(--wt)}
  #one #prohdr .wk-max:not(#z){border-radius:7px;font:500 10.5px var(--wmono)}
  #one #prohdr .unhint:not(#z),#one #prohdr .wk-seln:not(#z){flex:0 1 auto;min-width:0;margin:0;font:400 9px var(--wmono);letter-spacing:.1em;text-transform:uppercase;color:var(--ws);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #one #prohdr .unhint:empty,#one #prohdr .wk-seln:empty{display:none}
  /* the lists start where Redelegate's does and read as its rows */
  #one #prolist:not(#z){gap:0}
  #one #prolist .unpick:not(#z){display:flex;flex-direction:column;gap:0;margin:0;padding:0;border:0;max-height:none}
  #one #prolist .unhead{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;height:26px;padding:0 6px 0 38px;
    border-bottom:1px solid var(--wbd);background:var(--wc);font:400 9px var(--wmono);letter-spacing:.1em;text-transform:uppercase;color:var(--wf)}
  #one #prolist .unrow:not(#z):not(#y){display:flex;align-items:center;gap:9px;height:32px;min-height:32px;margin:0;padding:0 6px;border:0;border-bottom:1px solid var(--wbd);
    border-radius:0;background:none;box-shadow:none;cursor:pointer}
  #one #prolist .unrow.on:not(#z):not(#y){background:rgba(43,200,189,.07)}
  #one #prolist .unrow b:not(#z){flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:500 13.5px var(--wsans);color:var(--wt)}
  #one #prolist .unrow i:not(#z){margin-left:auto;font:500 12px var(--wmono);font-style:normal;color:var(--wt)}
  #one #prolist .unrow i em{display:none}
  #one #prolist .unrow input:not(#z){flex:0 0 auto;width:15px;height:15px;margin:0 4px 0 0}
  #one #prolist .unrow .wk-lg:not(#z){width:16px;height:16px;margin:0}
  #one #prolist .stlist:not(#z){margin:0;border:0;padding:0}
  #one #prolist .stlist td:not(#z){height:32px}
}
/* the title, the field and the list sit at one place in every tab */
@media(min-width:1100px){
  /* every tab's title takes Redelegate's width, so the field (or the count) starts where Redelegate's does */
  #one #p-dele #wk-plan>.wk-ph h3:not(#z){min-width:0;flex:0 0 auto}
  html[data-pro] #one #p-dele #wk-plan>.wk-ph h3:not(#z){width:var(--rdh,114px)}
  /* the amount field sits beside the title, the same in every tab; its button says MAX, the figure is the field's */
  #one #p-dele #wk-plan>.wk-ph .wk-max b{display:none}
  #one #p-dele #wk-plan>.wk-ph .wk-max:not(#z):not(#y){padding:0 9px}
  #one #p-dele #wk-plan .wk-ph .wk-field:not(#z):not(#y){flex:0 0 150px;width:150px;max-width:150px}
  #one #prolist:not(#z):not(#y){margin-top:10px}
  /* Redelegate's Outcome: now → after and ATONE/year on one row; the 21 days as the note above the button */
  #one #p-dele #wk-mv .wk-ans:not(#z):not(#y){grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)}
  #one #p-dele #wk-mv .wk-ans .p.rate:not(#z):not(#y){grid-column:auto}
  #one #p-dele #wk-mv .wk-ans .p.lock{display:none!important}
  /* every note at Outcome's foot reads as Stake's: one small mono line in a light box */
  #one #wk-mv .rdnote:not(#z),#one #proout .txlock:not(#z):not(#y){display:flex;align-items:center;gap:8px;margin:auto 0 12px;padding:9px 12px;border-radius:8px;
    border:1px solid rgba(255,176,46,.28);background:rgba(255,176,46,.05);width:auto;max-width:none;align-self:stretch}
  #one #wk-mv .rdnote span:not(#z),#one #proout .txlock span:not(#z){font:400 9px/1.45 var(--wmono);letter-spacing:.04em;color:var(--ws)}
  #one #wk-mv .rdnote span b:not(#z),#one #proout .txlock span b:not(#z){font-weight:400;color:var(--wamber)}
  #one #wk-mv .rdnote svg:not(#z),#one #proout .txlock svg:not(#z){width:12px;height:12px;margin:0;flex:0 0 auto}
  #one #p-dele #wk-mv #dgo:not(#z):not(#y){margin-top:0}
  #one #p-dele #wk-mv .wk-mvempty:not(#z){flex:1 1 auto}
}
#rdnote{display:none}
@media(min-width:1100px){html[data-sv="dashboard/self"]:not([data-pro]) #one #rdnote:not(#z):not(#y){display:flex}}
/* Outcome in every tab as Redelegate's: the breakdown takes the room and scrolls, the fee line, the note and the
   button hold fixed places at the foot */
@media(min-width:1100px){
  #one #proout:not(#z):not(#y){overflow:hidden;gap:10px}
  #one #proout .pro-brk:not(#z){flex:1 1 auto;min-height:0;overflow:hidden;order:-1;display:flex;flex-direction:column;gap:10px}
  #one #proout .pro-ans:not(#z){flex:0 0 auto}
  #one #proout .pro-brk-s{flex:1 1 auto;min-height:0;overflow-y:auto}
  #one #proout .txfee:not(#z),#one #proout .txstep:not(#z){order:1;flex:0 0 auto}
  #one #proout .txlock:not(#z):not(#y):not(#x){order:2;flex:0 0 auto;margin:0 0 2px}
  #one #proout .txbtns:not(#z):not(#y){order:3;flex:0 0 auto;margin:0}
  #one #prolist .stlist tbody tr{cursor:pointer}
  #one #prolist .stlist tbody tr.on td:not(#z){background:rgba(43,200,189,.07)}
}
/* the docked lists' names and boxes are Redelegate's: 12px names, square 15px boxes with the tick */
@media(min-width:1100px){
  #one #prolist .unrow b:not(#z):not(#y),#one #prolist .stlist td.nm:not(#z) span,#one #prolist .stlist td.nm:not(#z){font:500 12px var(--wsans)}
  #one #prolist .unrow input:not(#z):not(#y){appearance:none;-webkit-appearance:none;position:relative;flex:0 0 auto;width:15px;height:15px;margin:0 4px 0 0;padding:0;
    border:1px solid var(--wbd2);border-radius:4px;background:linear-gradient(180deg,#17172f,#0e0e1d);box-shadow:none;cursor:pointer}
  #one #prolist .unrow input:checked:not(#z):not(#y){background:linear-gradient(180deg,#3cf07a,#22c65c);border-color:#2ee06a}
  #one #prolist .unrow input:checked::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;border:solid #062012;border-width:0 2px 2px 0;transform:rotate(45deg)}
  #one #prolist .unrow input::before{display:none}
}
/* Unstake's status column: Active, Inactive or Jailed, between the name and the amount */
.unrow .vst{display:none}
@media(min-width:1100px){
  #one #prolist .unhead .h-st{margin-left:auto;width:84px;text-align:left}
  #one #prolist .unhead .h-x{width:90px;text-align:right}
  #one #prolist .unrow .vst{display:inline-block;flex:0 0 84px;text-decoration:none;font:500 9px var(--wmono);letter-spacing:.08em;text-transform:uppercase}
  #one #prolist .unrow .vst.a{color:var(--wcyan)}
  #one #prolist .unrow .vst.o{color:var(--wamber)}
  #one #prolist .unrow .vst.j{color:var(--wburn,#ff6a3d)}
  #one #prolist .unrow i:not(#z):not(#y){flex:0 0 90px;margin-left:0;text-align:right}
}
/* docked Unstake and Claim are Redelegate's table now (.wk-tbl2): the label rows' styling no longer applies */
@media(min-width:1100px){
  #one #prolist .unpick.wk-tbl2:not(#z):not(#y){display:block;flex:1 1 auto;min-height:0;overflow-y:auto}
  #one #prolist .vst{display:inline-block;text-decoration:none;font:500 9px var(--wmono);letter-spacing:.08em;text-transform:uppercase}
  #one #prolist .vst.a{color:var(--wcyan)}
  #one #prolist .vst.o{color:var(--wamber)}
  #one #prolist .vst.j{color:var(--wburn,#ff6a3d)}
  #one #prolist .wk-tbl2 tbody tr{cursor:pointer}
  #one #prolist .wk-tbl2 tbody tr.on td:not(#z):not(#y){background:rgba(46,224,106,.045)}
  #one #prolist .wk-tbl2 tbody tr.on td:first-child:not(#z):not(#y){box-shadow:inset 2px 0 0 var(--wgreen)}
  #one #prolist .wk-tbl2 td.nm:not(#z):not(#y),#one #prolist .wk-tbl2 td.nm span:not(#z):not(#y){font:500 12px var(--wsans)}
  #one #prolist .wk-tbl2 td:not(#z):not(#y){height:32px}
}
/* the docked lists' select-all box is Redelegate's */
#prolist thead th.ck input{appearance:none;-webkit-appearance:none;width:15px;height:15px;margin:0;border-radius:4px;border:1px solid var(--wbd2);background:linear-gradient(180deg,#17172f,#0e0e1d);box-shadow:inset 0 1px 0 rgba(255,255,255,.05);cursor:pointer;position:relative;vertical-align:middle;transition:border-color .12s,box-shadow .12s,background .12s}
#prolist thead th.ck input:hover{border-color:var(--ws)}
#prolist thead th.ck input:checked{background:linear-gradient(180deg,#3cf07a,#22c65c);border-color:#2ee06a;box-shadow:0 0 0 3px rgba(46,224,106,.14)}
#prolist thead th.ck input:checked::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;border:solid #062012;border-width:0 2px 2px 0;transform:rotate(45deg)}
#prolist thead th.ck input:indeterminate{border-color:#2ee06a;background:linear-gradient(180deg,#17172f,#0e0e1d)}
#prolist thead th.ck input:indeterminate::after{content:"";position:absolute;left:3px;right:3px;top:6px;height:2px;background:#2ee06a;border-radius:1px}
#prolist thead th.ck input{position:relative;cursor:pointer;vertical-align:middle}
/* Outcome's figures are small and sit on its title row, in every tab (operator, 2026-09-30); the body takes the rest */
#proans{display:none}
@media(min-width:1100px){
  #one #p-dele #wk-mv.wk-pane:not(#z):not(#y){display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto auto;column-gap:12px;align-content:stretch}
  #one #p-dele #wk-mv>.wk-ph:not(#z){grid-area:1/1/2/2}
  #one #p-dele #wk-mv>#dans:not(#z):not(#y),#one #p-dele #wk-mv>#proans:not(#z):not(#y){grid-area:1/2/2/3;justify-self:end;align-self:start;
    display:flex;gap:6px;margin:0;min-width:0}
  #one #p-dele #wk-mv>.wk-moves:not(#z):not(#y),#one #p-dele #wk-mv>.wk-mvempty:not(#z):not(#y){grid-area:2/1/3/3}
  #one #p-dele #wk-mv>#rdnote:not(#z):not(#y){grid-area:3/1/4/3}
  #one #p-dele #wk-mv>#dgo:not(#z):not(#y){grid-area:4/1/5/3}
  #one #p-dele #wk-mv>#proout:not(#z):not(#y){grid-area:2/1/5/3}
  html[data-pro] #one #p-dele #wk-mv>#proans:not(#z):not(#y){display:flex!important}
  html:not([data-pro]) #one #p-dele #wk-mv>#proans{display:none!important}
  /* a figure is one line: the label, then the value */
  #one #p-dele #wk-mv>.wk-ans .p:not(#z):not(#y){display:inline-flex;flex-direction:row;flex-wrap:nowrap;align-items:baseline;gap:6px;height:30px;min-height:0;padding:7px 10px 0;
    border:1px solid var(--wbd);border-radius:8px;white-space:nowrap}
  #one #p-dele #wk-mv>.wk-ans .p i:not(#z){font-size:8.5px;letter-spacing:.1em}
  #one #p-dele #wk-mv>.wk-ans .p b:not(#z){font-size:13px}
  #one #p-dele #wk-mv>.wk-ans .p .arr{margin:0 2px}
  #one #p-dele #wk-mv>.wk-ans .p.rate i:nth-of-type(2){display:none}
  #one #p-dele #wk-mv>.wk-ans .p.lock{display:none!important}
}
/* the title row reads the same in every tab: the count centred on the field's line, Outcome's figures on its title's */
@media(min-width:1100px){
  #one #p-dele #wk-plan>.wk-ph .wk-seln:not(#z):not(#y){align-self:center;display:inline-flex;align-items:center;height:32px;line-height:32px;margin:0}
  #one #p-dele #wk-plan>.wk-ph .wk-seln b:not(#z){line-height:32px}
  #one #p-dele #wk-mv>#dans:not(#z):not(#y),#one #p-dele #wk-mv>#proans:not(#z):not(#y){align-self:center;margin:0!important;padding:0!important;height:32px;align-items:center}
  #one #p-dele #wk-mv.wk-pane:not(#z):not(#y):not(#x){row-gap:8px}
  #one #p-dele #wk-mv>.wk-ph:not(#z):not(#y){margin:0;height:32px}
  #one #p-dele #wk-mv>.wk-ans .p:not(#z):not(#y):not(#x){align-items:center;padding:0 10px}
  #one #p-dele #wk-mv>.wk-ans .p.rate i{display:none}
  #one #p-dele #wk-mv>.wk-ans .p.rate:not(#z):not(#y)::before{content:"APR";display:inline;position:static;height:auto;width:auto;background:none;opacity:1;font:400 8px var(--wmono);letter-spacing:.1em;text-transform:uppercase;color:var(--wf)}
  /* the figures stay compact so two fit beside the title in any tab */
  #one #p-dele #wk-mv>.wk-ans .p:not(#z):not(#y):not(#x){gap:5px;padding:0 8px}
  #one #p-dele #wk-mv>.wk-ans .p i:not(#z):not(#y){font-size:8px;letter-spacing:.08em}
  #one #p-dele #wk-mv>.wk-ans .p b:not(#z):not(#y){font-size:12.5px}
  #one #prolist .wk-tbl2 td.nm .gtag.add:not(#z){flex:0 0 auto}
}
.ij-t.ij-0 .ij-b{cursor:default;opacity:.7}
/* Outcome's two figures on a full row under the title, half the width each, values never overflow (operator, 2026-09-30) */
@media(min-width:1100px){
  #one #p-dele #wk-mv.wk-pane:not(#z):not(#y):not(#x):not(#w){grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto auto}
  #one #p-dele #wk-mv>.wk-ph:not(#z):not(#y):not(#x){grid-area:1/1/2/2}
  #one #p-dele #wk-mv>#dans:not(#z):not(#y):not(#x),#one #p-dele #wk-mv>#proans:not(#z):not(#y):not(#x){grid-area:2/1/3/2;justify-self:stretch;align-self:stretch;
    display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;height:auto}
  html:not([data-pro]) #one #p-dele #wk-mv>#proans{display:none!important}
  html[data-pro] #one #p-dele #wk-mv>#dans{display:none!important}
  #one #p-dele #wk-mv>.wk-moves:not(#z):not(#y):not(#x),#one #p-dele #wk-mv>.wk-mvempty:not(#z):not(#y):not(#x){grid-area:3/1/4/2}
  #one #p-dele #wk-mv>#rdnote:not(#z):not(#y):not(#x){grid-area:4/1/5/2}
  #one #p-dele #wk-mv>#dgo:not(#z):not(#y):not(#x){grid-area:5/1/6/2}
  #one #p-dele #wk-mv>#proout:not(#z):not(#y):not(#x){grid-area:3/1/6/2}
  #one #p-dele #wk-mv>.wk-ans .p:not(#z):not(#y):not(#x):not(#w){display:flex;justify-content:space-between;align-items:center;gap:8px;min-width:0;width:auto;height:34px;padding:0 10px}
  #one #p-dele #wk-mv>.wk-ans .p b:not(#z):not(#y):not(#x){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}
  #one #p-dele #wk-mv>.wk-ans .p i:not(#z):not(#y):not(#x){flex:0 0 auto}
  /* APR now → after: the arrow and the after figure ride with the value on the right */
  #one #p-dele #wk-mv>.wk-ans .p.rate:not(#z):not(#y):not(#x){justify-content:flex-start}
  #one #p-dele #wk-mv>.wk-ans .p.rate::before{margin-right:auto}
}
/* the set chart at the design's size (operator, 2026-09-30, the proposal's picture): a compact strip, ~90px of bars,
   thin with small gaps - it no longer stretches to fill the stage */
@media(min-width:1100px){
  #mv-stage .mv-set:not(#z):not(#y){flex:0 0 auto;min-height:0}
  #mv-stage .mv-bars:not(#z):not(#y){flex:0 0 auto;height:140px;min-height:0;gap:3px}
  #mv-stage .mv-bars i:not(#z){border-radius:2px 2px 0 0}
}
@media(min-width:1100px) and (max-height:820px){#mv-stage .mv-bars:not(#z):not(#y){height:96px}}
@media(min-width:1100px) and (max-height:680px){#mv-stage .mv-bars:not(#z):not(#y){height:64px}}
/* the shortest screens: the chart keeps its bars and bracket but drops its titles; the stage's text rows tighten */
@media(min-width:1100px) and (max-height:640px){
  #mv-stage .mv-bars:not(#z):not(#y){height:30px}
  #mv-stage .mv-sh:not(#z){display:none}
  #mv-stage .mv-hl>b:not(#z){font-size:26px}
  #mv-stage .mv-box .mv-r:not(#z){padding:3px 0}
  #mv-stage .mv-ap:not(#z){padding:8px 12px}
  #mv-stage .mv-ap .mv-ghost:not(#z){height:34px}
}
/* Your move: the action in the title row's corner, the chip just left of it; the set chart pinned to the foot, its
   bars each opening the validator (operator, 2026-09-30) */
#mv-stage .mv-top{min-height:38px}
#mv-stage .mv-top .mv-chip{margin-left:auto}
#mv-stage .mv-top>em+.mv-tgo,#mv-stage .mv-top>em+.mv-ton{margin-left:auto}
#mv-stage .sv-btn.go.mv-go.mv-tgo:not(#z):not(#y){height:38px;min-width:0;padding:0 18px;font-size:14px;flex:0 0 auto}
#mv-stage .mv-top .mv-ton:not(#z){font-size:14px;margin-left:10px}
#mv-stage .mv-set:not(#z):not(#y):not(#x){margin-top:auto}
#mv-stage .mv-bars i{cursor:pointer}
#mv-stage .mv-bars i:hover{filter:brightness(.82)}
#mv-stage .mv-top>em+.mv-tdis{margin-left:auto}
#mv-stage .mv-tdis{position:relative;display:inline-flex;flex:0 0 auto}
#mv-stage .mv-tdis .mv-tgo:disabled:not(#z):not(#y){opacity:.45;cursor:not-allowed;filter:grayscale(1)}
#mv-stage .mv-tdis:hover::after{content:attr(data-tip);position:absolute;right:0;top:calc(100% + 6px);z-index:4;padding:6px 10px;border-radius:8px;
  border:1px solid var(--wbd2);background:var(--wh);box-shadow:0 10px 24px -14px rgba(0,0,0,.6);font:600 12px var(--wsans);color:var(--wt);white-space:nowrap;pointer-events:none}
/* Delegations' select-all box is Redelegate's */
#dmy thead th.ck input{appearance:none;-webkit-appearance:none;width:15px;height:15px;margin:0;border-radius:4px;border:1px solid var(--wbd2);background:linear-gradient(180deg,#17172f,#0e0e1d);box-shadow:inset 0 1px 0 rgba(255,255,255,.05);cursor:pointer;position:relative;vertical-align:middle;transition:border-color .12s,box-shadow .12s,background .12s}
#dmy thead th.ck input:hover{border-color:var(--ws)}
#dmy thead th.ck input:checked{background:linear-gradient(180deg,#3cf07a,#22c65c);border-color:#2ee06a;box-shadow:0 0 0 3px rgba(46,224,106,.14)}
#dmy thead th.ck input:checked::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;border:solid #062012;border-width:0 2px 2px 0;transform:rotate(45deg)}
#dmy thead th.ck input:indeterminate{border-color:#2ee06a;background:linear-gradient(180deg,#17172f,#0e0e1d)}
#dmy thead th.ck input:indeterminate::after{content:"";position:absolute;left:3px;right:3px;top:6px;height:2px;background:#2ee06a;border-radius:1px}
#dmy thead th.ck input{position:relative;cursor:pointer;vertical-align:middle}
#dmy tbody tr.on td{background:rgba(46,224,106,.045)}
#dmy td.ck input:disabled{opacity:.35;cursor:not-allowed}
#dmy td.ck,#dmy th.ck{text-overflow:clip;overflow:visible;padding:0 2px 0 4px}
/* ════ STICKY HEADS (operator, 2026-09-30): a list's column titles stay on top as it scrolls, on the pane's own
   colour, so rows never show through them - Redelegate, Delegations, Outcome's moves, Stake's list, Picks ════ */
#one #p-dele .wk-tbl2 thead th:not(#z):not(#y),#you .wk-tbl2 thead th:not(#z):not(#y),#one #p-dele #wk-mv .wk-moves thead th:not(#z):not(#y),
#one #prolist .stlist thead th:not(#z):not(#y),#one .pro-brk-t thead th:not(#z):not(#y){position:sticky;top:0;z-index:2;background:var(--wc)}
#one #p-pays .ptab thead th:not(#z):not(#y){position:sticky;top:0;z-index:2;background:var(--card,#09090f)}
/* ════ FOLDING THE SIDES (operator, 2026-09-30): the wallet column and the paths rail each fold on a click, for
   the room governance and Pro need; both are open on every load. The wallet column folds away (the header keeps the
   wallet), the rail folds to its icons. The handles sit in the gutters, halfway down. ════ */
.colh{display:none}
@media(min-width:1100px){
  #one.one{position:relative;--yw:300px;--rw:256px;--pl:24px;--pr:24px;--g:18px}
  html:not([data-sv="dashboard/autopilot"]) #one.one:not(#z){grid-template-columns:var(--yw) minmax(0,1fr) var(--rw)}
  html:not([data-sv="dashboard/autopilot"]) #one>#you{grid-column:1}
  html:not([data-sv="dashboard/autopilot"]) #one>.panes{grid-column:2}
  html:not([data-sv="dashboard/autopilot"]) #one>#paths{grid-column:3}   /* a folded column keeps its place */
  html[data-youc] #one.one:not(#z){--yw:0px}
  html[data-youc] #one #you:not(#z){display:none}
  html[data-railc] #one.one:not(#z){--rw:78px}
  .colh{display:flex;align-items:center;justify-content:center;position:absolute;top:50%;z-index:3;width:14px;height:56px;margin-top:-28px;padding:0;
    border:1px solid var(--wbd2,#34345c);border-radius:8px;background:var(--wc,#0e0e1d);color:var(--wf,#8f8db4);cursor:pointer}
  .colh svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;transition:transform .18s ease}
  .colh:hover,.colh:focus-visible{border-color:var(--sv-teal,#2bc8bd);color:var(--sv-teal,#2bc8bd);outline:none}
  .colh-y{left:calc(var(--pl) + var(--yw) + (var(--g) - 14px) / 2)}
  html[data-youc] .colh-y{left:calc(var(--pl) - 7px)}
  html[data-youc] .colh-y svg{transform:rotate(180deg)}
  .colh-r{right:calc(var(--pr) + var(--rw) + (var(--g) - 14px) / 2)}
  .colh-r svg{transform:rotate(180deg)}
  html[data-railc] .colh-r svg{transform:none}
}
@media(min-width:1100px) and (max-width:1599px){#one.one{--yw:272px;--rw:232px;--pl:18px;--pr:18px;--g:14px}}
@media(prefers-reduced-motion:reduce){.colh svg{transition:none}}
/* a folded rail: the paths as icons with their short names */
@media(min-width:1100px){
  html[data-railc] .pth{align-items:center;justify-content:center;gap:5px;padding:8px 4px;text-align:center}
  html[data-railc] .pth em,html[data-railc] .pth b,html[data-railc] .pth small{display:none}
  html[data-railc] .pth .ps{display:block;font-size:10.5px;color:var(--ws);max-width:100%;overflow:hidden;text-overflow:ellipsis}
  html[data-railc] .pth svg{display:block;width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;color:var(--ws)}
  html[data-railc] .pth.on svg,html[data-railc] .pth.on .ps{color:var(--sv-teal)}
}
/* the narrowest desktop: the economics price row a size smaller, so it keeps every figure on one line */
@media(min-width:1100px) and (max-width:1319px){
  #sv-eco .sv-tp{margin-left:8px;padding-left:8px;gap:6px;font-size:.9em}
  #sv-eco .sv-tp small{font-size:9px;letter-spacing:.06em}
  #sv-eco .sv-trole{margin-left:6px;padding:0 6px;font-size:8.5px;height:18px}
  #sv-eco .sv-gkey{font-size:8.5px}
}
/* a very short screen: the set's chart gives way first, so the action never leaves the stage */
/* a short screen: the set chart stays (operator, 2026-09-30: "graph not anywhere") at a smaller height; the lists show
   three rows before "and N more", the headline and gaps tighten */
@media(min-width:1100px) and (max-height:820px){
  #mv-stage.mv-stage:not(#z){gap:10px;padding-top:14px;padding-bottom:14px}
  #mv-stage .mv-hl>b{font-size:30px}
  #mv-stage .mv-hl>span{font-size:12.5px}
  #mv-stage .mv-set:not(#z){min-height:56px}
  #mv-stage .mv-days:not(#z){padding:10px 14px;gap:6px}
  #mv-stage .mv-cyc>div:not(#z){padding:8px 11px}
}
@media(min-width:1100px) and (max-height:680px){
  #mv-stage .mv-days small{display:none}
  #mv-stage .mv-hl>span{display:none}
  #mv-stage .mv-set:not(#z){min-height:48px}
}
/* a short screen (a laptop at 600-780px): everything a size tighter, the switches without their line */
@media(min-width:1100px) and (max-height:780px){
  .one{padding-top:12px;padding-bottom:14px;gap:14px}
  #you{padding:14px 16px 12px;gap:12px}
  .you-apr b{font-size:32px}
  .you-r{min-height:32px}
  .you-swt small{display:none}
  .you-sw{padding:7px 10px}
  .pth{padding:10px 13px}
  .pth small{-webkit-line-clamp:1}
  #mv-stage{padding:14px 18px 12px;gap:10px}
  .mv-hl>b{font-size:30px}
  .mv-hl>span{font-size:13.5px}
  .mv-r{padding:4px 0}
  .mv-box{padding:9px 12px 5px}
  #mv-stage .mv-act .sd-go,#mv-stage .mv-go{height:42px}
  .mv-days{padding:10px 14px;gap:6px}
}
@media(max-width:1099px){
  /* the paths: a bar at the foot, five doors, the open one lit; the page keeps room for it */
  #paths{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));position:fixed;left:0;right:0;bottom:0;z-index:40;
    height:calc(60px + env(safe-area-inset-bottom));padding:0 4px env(safe-area-inset-bottom);background:var(--wc);border-top:1px solid var(--wbd);font-family:var(--wsans)}
  .below{padding-bottom:calc(60px + env(safe-area-inset-bottom))}
  .pth{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;background:transparent;color:var(--ws);font:500 11px var(--wsans);cursor:pointer;min-width:0}
  .pth em,.pth b,.pth small{display:none}
  .pth .ps{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .pth svg{display:block;width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .pth.on{color:var(--sv-teal);font-weight:600}
  #mv-stage{padding:16px 14px;gap:14px;border-radius:12px}
  .mv-you{display:flex;flex-direction:column;gap:10px;padding-bottom:14px;border-bottom:1px solid var(--wbd)}
  .mv-yg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .mv-yk{display:flex;flex-direction:column;gap:2px;padding:9px 11px;border:1px solid var(--wbd);border-radius:10px;min-width:0}
  .mv-yk em{font-style:normal;font-family:var(--wmono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--wf)}
  .mv-yk b{font-family:var(--wmono);font-size:17px;font-weight:600;color:var(--wt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mv-ysw{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .mv-ysw .you-sw{padding:8px 10px}
  .mv-ysw .you-swt small{display:none}
  .mv-hl>b{font-size:30px}
  .mv-flow{grid-template-columns:minmax(0,1fr);gap:8px}
  .mv-arr{transform:rotate(90deg);height:22px}
  .mv-bars{flex:0 0 auto;height:72px}
  .mv-set{flex:0 0 auto;min-height:0}
  .mv-act{flex-direction:column;align-items:stretch;gap:10px}
  #mv-stage .mv-act .sd-go,#mv-stage .mv-go{width:100%}
  .mv-ap{flex-direction:column;align-items:stretch}
  .mv-cyc{grid-template-columns:repeat(2,minmax(0,1fr))}
}
</style>
<link rel=stylesheet href="assets/theme-day.css">
<!-- the shell's generated rules come last: they only name theme tokens, so they are right in
     day and night alike, and the day sheet's shadows must not unlight the open tab -->
<style>{{SHELL_CSS}}</style>
</head><body>
<svg width=0 height=0 style="position:absolute" aria-hidden=true><defs>
  <symbol id=g-eta viewBox="0 0 20 20"><path d="M6.6 4.6V14.6M6.6 8.2C7.6 5.8 13.4 5.4 13.4 9.4V15.6" fill=none stroke=currentColor stroke-width=2.2 stroke-linecap=round stroke-linejoin=round/></symbol>
  <symbol id=g-c viewBox="0 0 20 20"><path d="M14.6 6.2A6 6 0 1 0 14.6 13.8" fill=none stroke=currentColor stroke-width=2.3 stroke-linecap=round/></symbol>
  <symbol id=g-s viewBox="0 0 20 20"><path d="M13.9 6.4C12.9 4.7 6.7 4.5 6.5 7.6C6.3 10.5 13.7 9.5 13.5 12.5C13.3 15.5 7 15.3 6 13.5" fill=none stroke=currentColor stroke-width=2.3 stroke-linecap=round/></symbol>
</defs></svg>


<div class=below id=below>
  <header class=folder>
    <div class=brandwrap>
    <a class=brand href="./" data-route="intro" title="AtomOne"><img class=mark src="assets/atomone.svg" alt=""><span class=bw><span class=wordmark>AtomOne</span><span class=bheight id=dlive title="the chain's height, live"><i></i><b>{{HEIGHT}}</b><span class=btag>Autopilot</span></span></span></a>
    </div>
    <div class=hdr-r>
    <button class=thbtn id=thbtn type=button role=switch aria-checked=false aria-label="Day or night" title="Day"><svg class=sun viewBox="0 0 24 24" aria-hidden=true><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg><svg class=moon viewBox="0 0 24 24" aria-hidden=true><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg></button>
    <div class=netsw id=netsw role=group aria-label=Network><a id=netmain href="./" aria-label=Mainnet><span class=nl>Mainnet</span><span class=ns aria-hidden=true>Main</span></a><a id=nettest href="testnet/" aria-label=Testnet><span class=nl>Testnet</span><span class=ns aria-hidden=true>Test</span></a></div>
    <div class=sv-who>
      <button class="sv-btn sml pri" id=svconn type=button aria-haspopup=true aria-expanded=false>Connect wallet</button>
      <div class=wpill id=svacct hidden>
        <img class=wpl alt="">
        <button class=wpcopy id=svcopy type=button title="Copy address" aria-label="Copy address"><span class=wpa></span><svg class=cp viewBox="0 0 24 24" aria-hidden=true><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><svg class=ok viewBox="0 0 24 24" aria-hidden=true><path d="M4 12.5l5 5L20 6.5"/></svg></button>
        <button class=wpout id=svout type=button title="Disconnect" aria-label="Disconnect"><svg viewBox="0 0 24 24" aria-hidden=true><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></button>
      </div>
      <div class=sv-menu id=svmenu hidden></div>
    </div>
    </div>
    {{SHELL_L1}}
  </header>
  <div class=one id=one>
  <aside class=you id=you aria-label="Your wallet"></aside>
  <div class=panes id=well>
  <div class=w id=calc>
      <span class=calclab>Nakamoto</span>
    <header class=brandbar>
      <div class=bwrap data-title-for=staking><div class=bt><span class=btx><i class=nk>Nakamoto </i><i class=tsfx id=tsfx>Bonus</i></span></div></div>
      <div class=bwrap data-title-for=network><div class=bt><span class=btx><i class=nk>Network </i><i class="tsfx net tsub">Uptime</i></span></div></div>
      <div class=bwrap data-title-for=governance><div class=bt><span class=btx><i class=nk>Governance </i><i class="tsfx tsub">Proposals</i></span></div></div>
      <span class=sv-brand data-title-for=dashboard><span class=sv-bw><span class="bt svtag s"><span class=btx><i class=nk>Non-custodial </i><i class="tsfx grp-s">staking</i><i class="tsfx grp-g">Governance</i></span></span><span class="bt svtag a"><span class=btx><i class=nk>Decentralize and </i><i class=tsfx>earn more</i></span></span></span><span class=welc id=svwelc hidden></span></span>
      <div class=protabs id=protabs role=tablist aria-label="Pro"><div class=l2trk><button class=l2tab type=button role=tab data-pro-act=redelegate aria-selected=true><span>Redelegate</span></button><button class=l2tab type=button role=tab data-pro-act=stake aria-selected=false><span>Stake</span></button><button class=l2tab type=button role=tab data-pro-act=unstake aria-selected=false><span>Unstake</span></button><button class=l2tab type=button role=tab data-pro-act=claim aria-selected=false><span>Claim</span></button></div></div>
      <div class=l2host>{{SHELL_L2}}</div>
    </header>
  <div class=flipbox id=flipbox>
  <section class="pane on" id=p-home>
<div class=w><div class=fold>
  <div class="sec tight fw">
    <div class=frow>
      <span class=wifnote id=wifnote role=status hidden><i class=wiftag>What-if view</i><span id=wifn>1 slider moved from live</span><button class=wifall id=wifall type=button><span class=ri aria-hidden=true>&#8635;</span>Reset all</button></span>
      <span class=tapnote id=tapnote>tap any box<svg viewBox="0 0 24 24" aria-hidden=true><path d="M9 11V6a2 2 0 0 1 4 0v5M13 10V8a2 2 0 0 1 4 0v3M17 11a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L4 13.8a2 2 0 0 1 3.2-2.4L9 13.5V11"/></svg></span>
      <div class=modes>
        <button class=mbtn data-m=color aria-pressed=true>Map</button>
        <button class=mbtn data-m=apr aria-pressed=false>APR</button>
        <button class=mbtn data-m=stake aria-pressed=false>Stake</button>
        <button class=mbtn data-m=rank aria-pressed=false>Rank</button>
        <button class=mbtn data-m=logo aria-pressed=false>Logo</button>
        <button class=mbtn data-m=graph aria-pressed=false>Graph</button>
      </div></div>
    <div id=gwrap><div class=grid id=g2></div></div>
    <div id=cwrap style="display:none"><svg id=foldchart viewBox="0 0 900 232" role=img
      aria-label="Yield against stake, every curve crossing at the mean"></svg></div>
    <div class=aprbar>
      <div class=apre><span class=apnum id=aprlo>-</span><span class=aplab>lowest</span></div>
      <div class=apmid>
        <span class=apx>Smallest <b id=g2n>-</b> Largest</span>
        <span class=apspan></span>
        <span class=apxsub>APR</span>
      </div>
      <div class="apre right"><span class=apnum id=aprhi>-</span><span class=aplab>highest</span></div>
    </div>
  </div>

  <div class=duo>
  <div class="sec tight wrow" data-w=e>
    <div class=trackwrap>
      <input type=range id=eta class=gradrange min=3 max=100 value={{ETA_PCT}} aria-label="coefficient">
      <span class=knob id=knob style="{{KL_ETA}}"><svg class=kg aria-hidden=true><use href="#g-eta"/></svg></span>
      <span class="tick live" id=tke data-l="live"></span>
    </div>
    <div class=rlab><button class="etabox eta" id=qbtn type=button aria-label="How the coefficient works"><span
        class="disc de eb"><svg class=kg aria-hidden=true><use href="#g-eta"/></svg></span>bonus share <span class=sgoarr>&rarr;</span></button><span class=rv><b class=rval id=etatop>{{ETA}}</b><button class=rreset data-r=e type=button title="Back to the chain as it is (Esc on the slider does the same)"><span class=ri aria-hidden=true>&#8635;</span>Reset to <b class=rlive>{{ETA}}</b></button></span></div>
  </div>

  <div class="sec tight wrow" data-w=c>
    <div class=trackwrap>
      <input type=range id=concr class=gradrange min=100 max=1600 value=1041
        aria-label="concentration of staked ATONE">
      <span class="knob kconc" id=knob3 style="{{KL_C}}"><svg class=kg aria-hidden=true><use href="#g-c"/></svg></span>
      <span class="tick trip" id=tkt data-l="trips {{TRIPS}}x" data-v={{TRIPS_C}}></span>
      <span class="tick live" id=tkc data-l="live"></span>
    </div>
    <div class=rlab><button class="etabox conc" id=cbtn type=button aria-label="How concentration steers the coefficient"><span
        class="disc dc eb"><svg class=kg aria-hidden=true><use href="#g-c"/></svg></span>concentration <span class=sgoarr>&rarr;</span></button><span class=rv><b class=rval id=ctop>{{RATIO}}&times;</b><button class=rreset data-r=c type=button title="Back to the chain as it is (Esc on the slider does the same)"><span class=ri aria-hidden=true>&#8635;</span>Reset to <b class=rlive>{{RATIO}}&times;</b></button></span></div>
  </div>
  <div class="sec tight wrow" data-w=s>
    <div class=trackwrap>
      <input type=range id=bondr class=gradrange min=5 max=100 value=40
        aria-label="share of supply staked">
      <span class="knob kcool" id=knob2 style="{{KL_S}}"><svg class=kg aria-hidden=true><use href="#g-s"/></svg></span>
      <span class="tick live" id=tks data-l="live"></span>
    </div>
    <div class=rlab><button class="etabox cool" id=sbtn type=button aria-label="Staking figures"><span
        class="disc ds eb"><svg class=kg aria-hidden=true><use href="#g-s"/></svg></span>ATONE staked <span class=sgoarr>&rarr;</span></button><span class=rv><b class=rval id=bstake>{{BONDED_C}}</b><button class=rreset data-r=s type=button title="Back to the chain as it is (Esc on the slider does the same)"><span class=ri aria-hidden=true>&#8635;</span>Reset to <b class=rlive>{{BONDED_C}}</b></button></span></div>
    <input type=hidden id=bond value=0>
  </div>
  </div>
</div></div>
  </section>

  <section class=pane id=p-eta><div class=pw>
    <div class=duo2>
      <div class=panel><div class=ptitle>Projection</div>
<p class=sub>&eta; steps {{STEP}} every week: up while the BONDED ATONE <b class=hotc>concentration</b> is &ge; {{THRESH}}&times;, down while &lt; {{THRESH_N}}. {{STEPLINE}}</p>
    <svg id=etacurve viewBox="0 0 900 300" role=img
      aria-label="&eta; from the floor to today and projected forward"></svg>
    <div class=sbox>
      <div><div class=k>started at</div><div class=v style="color:var(--cold)">{{FLOOR}}</div><div class=s>{{START_DATE}}</div></div>
      <button class=sgo id=sgohist type=button aria-label="Every weekly step so far"><div class=k>today</div><div
        class=v style="color:var(--hot)">{{ETA}}</div>
        <div class=s>{{WEEK}} weeks <span class=sgoarr>&rarr;</span></div></button>
      <div><div class=k>cap</div><div class=v>{{CAP}}</div><div class=s>{{CAPSUB}}</div></div>
      <div><div class=k>next</div><div class=v>{{ETA_NEXT}}</div><div class=s>{{NEXT_DATE}}</div></div>
    </div>
      </div>
      <div class=panel><div class=ptitle>Effect</div>
<p class=sub>{{T10LINE}}</p>
    <svg id=trend viewBox="0 0 900 300" role=img tabindex=0
      aria-label="Top-ten proposal share over time. Open for a closer look."></svg>
    <div class=sbox>
      <div><div class=k>block share</div><div class=v>{{TOP10}}%</div><div class=s>from {{TOP10_FIRST}}%</div></div>
      <div><div class=k>{{SPEEDUP_K}}</div><div class=v style="color:var(--hot)">{{SPEEDUP}}</div><div class=s>{{SPEEDUP_SUB}}</div></div>
      <div><div class=k>left the top 10</div><div class=v style="color:var(--burn)">{{MV_TOP}}</div><div class=s>ATONE</div></div>
      <div><div class=k>net new bonded</div><div class=v>{{MV_NEW}}</div><div class=s>ATONE</div></div>
    </div>
      </div>
    </div>
  </div></section>


  <section class=pane id=p-pays><div class=pw>
    <div class=duotab>
      <div>
        <div class="tcap hot">Highest APR</div>
        <div class=ptw><table class=ptab><thead><tr><th>#</th><th>validator</th>
          <th>net APR</th><th>uptime</th><th>jailed</th></tr></thead>
        <tbody>{{APRTABLE}}</tbody></table></div>
      </div>
      <div>
        <div class="tcap earn">Highest avg APR</div>
        <div class=ptw><table class=ptab><thead><tr><th>#</th><th>validator</th>
          <th>avg</th><th>high</th><th>low</th></tr></thead>
        <tbody>{{EARNTABLE}}</tbody></table></div>
      </div>
      <div class=upcol>
        <div class="tcap cool">Highest uptime</div>
        <div class=ptw><table class=ptab><thead><tr><th>#</th><th>validator</th>
          <th>uptime</th><th>signed</th><th>missed</th><th>jailed</th></tr></thead>
        <tbody>{{UPTABLE}}</tbody></table></div>
      </div>
    </div>
  </div></section>
  </div>
  <section class=pane id=p-intro><div class=w>
    <div class=intro>
      <h1>The chain that <em>rewards decentralization</em></h1>
      <a class=introgo href="network" data-route="network">Network<svg viewBox="0 0 24 24" aria-hidden=true><path d="M4 12h15M13 6l6 6-6 6"/></svg></a>
      <a class=introby href="https://gatahub.zone/" target=_blank rel="noopener noreferrer" title="GATA HUB"><span>powered by</span><img src="assets/gata.png" alt="GATA HUB"></a>
    </div>
  </div></section>
  <!-- the shell's own panes: a sub-view with nothing built yet shows its empty state here,
       and a section that needs a wallet shows one connect screen while there is none -->
  <section class=pane id=p-empty role=tabpanel tabindex=0><div class=shell-box><div class=shell-empty id=shellempty></div></div></section>
  <section class=pane id=p-connect role=tabpanel tabindex=0><div class=shell-box><div class=shell-empty id=shellconnect></div></div></section>
  <section class=pane id=p-dele><div class=pw>
    <div class=wk-body id=wbody>
      <!-- Manage: the Overview's wallet strip, as it is (simple.js draws it, wstrip()) -->
      <div class="sv-panel sd-strip" id=sd-mstrip></div>
      <div class=wk-two>
        <section class=wk-pane id=wk-mine>
          <div id=wk-acct>
          <div class=wk-ap id=wkap hidden><span class=wk-apk>Autopilot</span><span class=wk-aps id=wkaps>Inactive</span><button class=wk-apb id=atbtn type=button title="Let GATA keep this stake where it earns most, inside limits you set">Activate</button></div>
          <header class="wk-ph wk-t1"><h3>Delegations</h3><span class=wk-pn id=dmyn></span>
            <div class=wk-foot id=dstat></div>
            <button class="wk-unb wk-rdb" id=rdbtn type=button title="Move stake between validators">Redelegate</button>
            <button class="wk-unb wk-stb" id=stbtn type=button hidden title="Stake liquid ATONE">Stake</button>
            <button class=wk-unb id=unbtn type=button hidden title="Unstake from a validator">Unstake</button>
            <button class="wk-unb wk-clb" id=clbtn type=button hidden title="Claim your staking rewards">Claim</button></header>
          <div class=wk-tbl2 id=dmy></div>
          <footer class=wk-pf><nav class=wk-pg id=dmypg></nav></footer>
          </div>
        </section>
        <section class=wk-pane id=wk-plan>
          <header class="wk-ph wk-t2"><h3>Redelegate</h3><div class=pro-hdr id=prohdr></div><div class=wk-field><input class=wk-amt2 id=amt type=text inputmode=decimal placeholder="amount" autocomplete=off spellcheck=false aria-label="ATONE to move"><button class=wk-max id=amtmax type=button title="Everything that can move">max <b id=ds-mov>-</b></button></div><div class=wk-pre id=amtseg hidden><button data-p=100 type=button aria-pressed=true>All</button></div><span class=wk-seln id=dseln aria-live=polite></span>
            <button class=wk-ib id=wrefresh type=button title="Read the chain again now" aria-label="Refresh"><svg viewBox="0 0 24 24" aria-hidden=true><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6M20.5 3.5v5h-5"/></svg></button>
            <span class=wk-ago id=dago title="the numbers follow every block tick; refresh re-reads your position">-</span>
            <span class=wk-lockn id=dlockn hidden></span></header>
          <div class=wk-tbl2 id=dpicks></div>
          <div class=pro-dock id=prolist hidden></div>
        </section>
        <section class=wk-pane id=wk-mv>
          <header class="wk-ph wk-mvh wk-t3" id=dmvh><h3>Outcome</h3><span class=wk-pn id=dmvn></span></header>
          <div class=wk-ans id=dans></div>
          <div class="wk-ans pro-ans" id=proans></div>
          <div class=wk-moves id=dstrat></div>
          <div class=wk-mvempty id=dmvempty>Select validators and enter a stake</div>
          <div class="txlock rdnote" id=rdnote><svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>Redelegated stake cannot be redelegated again for <b>21 days</b></span></div>
          <button class="wk-btn wk-go" id=dgo type=button disabled>Redelegate</button>
          <div class=pro-dock id=proout hidden><div class=pro-brk id=probrk></div></div>
        </section>
      </div>
    </div>
  </div></section>
  <!-- Simple: the dashboard's other face. Same window, same frame as the pane above. -->
  <div id=sv>
    <main class=sv-main>
      <section class="sv-screen sd-scr" id=sv-over data-sc=over aria-label=Wallet>
        <div class=mv-stage id=mv-stage></div>
        <div class="sv-panel sd-strip" id=sd-wstrip></div>
        <div class="sd-grid sd-wgrid">
          <div class="sv-panel sd-col" id=sd-list></div>
          <div class="sv-panel sd-col" id=sd-sky></div>
          <div class="sv-panel sd-col" id=sd-move></div>
        </div>
      </section>
      <section class="sv-screen sd-scr" id=sv-auto data-sc=auto aria-label=Autopilot>
        <div class="sv-panel sd-strip" id=sd-astrip></div>
        <div class="sd-grid sd-agrid">
          <div class="sv-panel sd-col" id=sd-ado></div>
          <div class="sv-panel sd-col" id=sd-asky></div>
          <div class="sv-panel sd-col" id=sd-alist></div>
          <div class="sv-panel sd-col" id=sd-ars></div>
        </div>
      </section>
      <section class=sv-screen id=sv-net data-sc=net aria-label=Network>
        <div class="sv-panel sv-up" id=sv-up></div>
        <div class=sv-row2 id=sv-netrow>
          <div class=sv-panel id=sv-pace></div>
        </div>
      </section>
      <section class=sv-screen id=sv-sign data-sc=sign aria-label=Signing>
        <div class="sv-panel sv-gridp" id=sv-signp></div>
      </section>
      <section class=sv-screen id=sv-prop data-sc=prop aria-label=Proposers>
        <div class=sv-panel id=sv-proplive></div>
        <div class="sv-panel sv-gridp" id=sv-prop24></div>
      </section>
      <section class=sv-screen id=sv-act data-sc=act aria-label=Activity>
        <div class=sv-panel id=sv-act7></div>
        <div class=sv-panel id=sv-actlive></div>
      </section>
      <section class=sv-screen id=sv-props data-sc=props aria-label=Proposals>
        <div class="sv-cards gv-strip" id=sv-propcards></div>
        <div class=sv-panel id=sv-proplist><div class=sv-ph><h3>Proposals</h3></div><div class=sv-upwait>Reading the proposals…</div></div>
      </section>
      <section class=sv-screen id=sv-cons data-sc=cons aria-label=Constitution>
        <div class=cn-wrap id=sv-consp><div class=sv-upwait>Opening the constitution…</div></div>
      </section>
      <section class=sv-screen id=sv-daos data-sc=daos aria-label="Core DAOs">
        <div class="sv-cards gv-strip" id=sv-daocards></div>
        <div class=sv-panel id=sv-daop><div class=sv-ph><h3>Core DAOs</h3></div><div class=sv-upwait>Reading the chain…</div></div>
      </section>
      <section class=sv-screen id=sv-govs data-sc=govs aria-label=Governors>
        <div class="sv-cards gv-strip" id=sv-govcards></div>
        <div class=sv-panel id=sv-govlist><div class=sv-ph><h3>Governors</h3></div><div class=sv-upwait>Reading the governors…</div></div>
      </section>
      <section class=sv-screen id=sv-mygov data-sc=mygov aria-label="Your governor">
        <div class="sv-panel sd-strip" id=sd-gstrip></div>
        <div class="sd-grid sd-ggrid">
          <div class="sv-panel sd-col" id=sv-mygovp><div class=sv-ph><h3>Your governor</h3></div><div class=sv-upwait>Reading…</div></div>
          <div class="sv-panel sd-col" id=sv-mygovlist></div>
          <div class="sv-panel sd-col" id=sd-gvote></div>
        </div>
      </section>
      <section class=sv-screen id=sv-eco data-sc=eco aria-label=Economics>
        <div class=sv-panel id=sv-ecoa></div>
        <div class=sv-panel id=sv-ecop></div>
      </section>
    </main>
  </div>
  </div>
  </div>
  <nav class=paths id=paths aria-label=Paths></nav>
  <!-- fold the wallet column and the paths rail (open on every load; folded only by a click) -->
  <button class="colh colh-y" id=youc type=button aria-controls=you aria-expanded=true aria-label="Fold the wallet column"><svg viewBox="0 0 24 24" aria-hidden=true><path d="M15 5l-7 7 7 7"/></svg></button>
  <button class="colh colh-r" id=railc type=button aria-controls=paths aria-expanded=true aria-label="Fold the paths"><svg viewBox="0 0 24 24" aria-hidden=true><path d="M15 5l-7 7 7 7"/></svg></button>
  </div>
</div>


<div class=wk-notes id=txnotes aria-live=polite></div>

<div class=pop id=vpop><div class="card vcard">
  <div class="vhead vwrap"><img class=vlogo id=vlogo alt=""><span class=vmono id=vmono></span>
    <div class=vcol>
      <div class=vname><span class=vnm id=vname>-</span><span class=vrk id=vrank></span></div>
      <div class=vsub>
        <a class=vweb id=vweb target=_blank rel="noopener noreferrer"></a>
      </div>
    </div></div>
  <div class=vbadges id=vbadges></div>
  <div class=aprband>
    <span class=aprbig id=vapr>-</span>
    <span class=aprstack>
      <span class=aprlab>APR</span>
      <span class="aprx aprnet">Net<b id=vnet>-</b></span>
    </span>
    <span class=aprx><b id=vearn>-</b> avg</span>
  </div>
  <div class=vgrid>
    <div class=vstat><span class=vk>voting power</span><span class=vv id=vvp>-</span></div>
    <div class=vstat><span class=vk>ATONE staked</span><span class=vv id=vstake>-</span></div>
    <div class=vstat><span class=vk>commission</span><span class=vv id=vcomm>-</span></div>
    <div class=vstat><span class=vk>blocks proposed</span><span class=vv id=vprop>-</span></div>
    <div class=vstat><span class=vk>joined</span><span class=vv id=fjoin>-</span></div>
    <div class=vstat><span class=vk>last jail or slash</span><span class=vv id=flast>-</span></div>
  </div>
  <div class=upsec>
    <div class=pingwrap>
      <div class=pinghead><span class=pingttl>signing</span>
          <button class=notify id=vbell type=button
            title="Choose which alerts to get for this validator"><svg class=march aria-hidden=true><rect x=".5" y=".5" rx="5" ry="5" width="100%" height="100%"/></svg><svg viewBox="0 0 24 24"
            aria-hidden=true><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8
            l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.35-.1-.55-.6-.2L6.2 13.1 1.4
            11.6c-1-.3-1-1 .2-1.5l19-7.3c.85-.3 1.6.2 1.3 1.5z"/></svg>alert</button>
        <span class=pingh id=pingh>#{{HEIGHT}}</span></div>
      <div class=upbars id=ubping></div>
    </div>
    <div class=upnums>
      <div class=upcell><span class=upn id=uv10>-</span><span class=upl>10k blocks</span></div>
      <div class=upcell><span class=upn id=uv30>-</span><span class=upl>30 days</span></div>
      <div class=upcell><span class=upn id=uv90>-</span><span class=upl>90 days</span></div>
    </div>
  </div>
</div></div>

<div class=pop id=cpop><div class="card vcard kp kp-c">
  <div class=kp-h>
    <button class=backq id=backq type=button aria-label="Back to the bonus share">&larr; <span class=lc>&eta;</span></button>
    <span class="disc dc"><svg class=kg aria-hidden=true><use href="#g-c"/></svg></span>
    <div><h2>Concentration</h2><p>How much more the largest third holds than the smallest third average</p></div></div>
  <div class=kp-b>
    <div class=kp-eq>
      <div class=kp-hv><em>Largest third</em><b><span data-kp=HIGH>{{HIGH}}</span></b><small>average of <span data-kp=GROUP>{{GROUP}}</span></small></div>
      <i aria-hidden=true>&divide;</i>
      <div class=kp-hv><em>Smallest third</em><b><span data-kp=LOW>{{LOW}}</span></b><small>average of <span data-kp=GROUP_LO>{{GROUP_LO}}</span></small></div>
      <i aria-hidden=true>=</i>
      <div class="kp-hv kp-res"><em>Concentration</em><b class=or><span data-kp=RATIO>{{RATIO}}</span>&times;</b><small>times as large</small></div>
    </div>
    <div class="kp-g kp-g3">
      <div class=kp-f><em><span class=lc>&eta;</span> reverses when</em><b><span data-kp=REV_WHEN>{{REV_WHEN}}</span></b></div>
      <div class=kp-f><em>Could halt the chain</em><b><span class=haltn>{{NK}}</span></b><small>validators together</small></div>
      <div class=kp-f><em>Validators</em><b><span data-kp=N>{{N}}</span></b><small>in the active set</small></div>
    </div>
    <p class=kp-move>To go from <b><span data-kp=RATIO>{{RATIO}}</span>&times;</b> to <b><span data-kp=THRESH>{{THRESH}}</span>&times;</b>, <b class=or><span data-kp=MOVE>{{MOVE}}</span> ATONE</b> would have to move from the <span class=kp-lw><span data-kp=MOVE_FROM>{{MOVE_FROM}}</span></span> third of validators to the <span class=kp-lw><span data-kp=MOVE_TO>{{MOVE_TO}}</span></span> third.</p>
  </div>
</div></div>
<div class=pop id=spop><div class="card vcard kp kp-s">
  <div class=kp-h><span class="disc ds"><svg class=kg aria-hidden=true><use href="#g-s"/></svg></span>
    <div><h2>ATONE staked</h2><p>How much ATONE is bonded, and where the newly minted ATONE goes</p></div></div>
  <div class=kp-b>
    <div class=kp-big><b class=am><span data-kp=BONDED>{{BONDED}}</span></b><em>ATONE staked, <strong><span data-kp=BONDED_PCT>{{BONDED_PCT}}</span>%</strong> of <span data-kp=SUPPLY>{{SUPPLY}}</span></em>
      <span class=kp-bar><i style="width:{{BONDED_PCT}}%"></i></span></div>
    <div class=kp-g>
      <div class=kp-f><em>Inflation</em><b><span data-kp=INFL>{{INFL}}</span>%</b><small>a year</small></div>
      <div class=kp-f><em>Minted</em><b><span data-kp=MINTED>{{MINTED}}</span></b><small>ATONE a year</small></div>
      <div class=kp-f><em>Reward pool</em><b><span data-kp=POOL>{{POOL}}</span></b><small>ATONE a year, to stakers</small></div>
      <div class=kp-f><em>Community pool</em><b><span data-kp=CTAKE>{{CTAKE}}</span></b><small>ATONE a year, <span data-kp=TAX>{{TAX}}</span>% tax</small></div>
      <div class=kp-f><em>Delegators</em><b>{{DELEG}}</b><small>staking with <span data-kp=N>{{N}}</span> validators</small></div>
      <div class=kp-f id=kpgoal><em>Staking goal</em><b>-</b><small>&nbsp;</small></div>
    </div>
    <p class=kp-move id=kpgoalmv hidden></p>
  </div>
</div></div>
<div class=pop id=qpop><div class="card vcard kp kp-q">
  <div class=kp-h><span class="disc de"><svg class=kg aria-hidden=true><use href="#g-eta"/></svg></span>
    <div><h2>Bonus share <span class=lc>&eta;</span></h2><p>The share of all rewards split equally between the validators</p></div></div>
  <div class=kp-b>
    <div class=kp-hero>
      <div class=kp-hv><em>Now</em><b class=am><span data-kp=ETA>{{ETA}}</span></b><small>{{NOW_DATE}}</small></div>
      <i class=kp-arr aria-hidden=true>&rarr;</i>
      <div class=kp-hv><em>Projected</em><b class=gr><span data-kp=ETA_NEXT>{{ETA_NEXT}}</span></b><small>{{NEXT_DATE}}</small></div>
    </div>
    <div class=kp-g>
      <div class=kp-f><em>Weekly step</em><b>&plusmn; <span data-kp=STEP>{{STEP}}</span></b></div>
      <button class="kp-f kp-btn" id=histgo type=button aria-label="Every weekly step so far"><em>Weeks so far</em><b>{{WEEK}}<span class=kp-go>every step &rarr;</span></b></button>
      <div class=kp-f><em>Floor</em><b><span data-kp=FLOOR>{{FLOOR}}</span></b><small>where it started</small></div>
      <div class=kp-f><em>Cap</em><b><span data-kp=CAP>{{CAP}}</span></b><small>{{CAPSUB2}}</small></div>
    </div>
    <div class=kp-rule id=cgate role=button tabindex=0 aria-label="What concentration is, and where it stands">
      <div class="kp-ru {{RISE_ON}}"><em><span class=lc>&eta;</span> rises while</em><b>C &ge; <span data-kp=THRESH>{{THRESH}}</span>&times;</b></div>
      <div class="kp-ru {{FALL_ON}}"><em><span class=lc>&eta;</span> falls while</em><b>C &lt; <span data-kp=THRESH>{{THRESH}}</span>&times;</b></div>
      <span class=kp-rgo>Concentration &rarr;</span>
    </div>
    <div class=kp-g>
      <div class=kp-f><em>Reward pool</em><b><span data-kp=POOL>{{POOL}}</span></b><small>ATONE a year</small></div>
      <div class=kp-f><em>Validators</em><b><span data-kp=N>{{N}}</span></b><small>share the bonus equally</small></div>
    </div>
    <ul class="bul kp-notes">
      <li>At <b><span data-kp=ETA>{{ETA}}</span></b>, <b><span data-kp=ETA_PCT>{{ETA_PCT}}</span>%</b> of all rewards are split equally between the <span data-kp=N>{{N}}</span> validators.</li>
      <li>When <span class=lc>&eta;</span> rises, APR rises for every validator <b class=hov id=meanhov tabindex=0 data-tip="The average {{MEAN}} ATONE">below the average stake</b>.</li>
    </ul>
  </div>
</div></div>
<div class=pop id=txpop><div class="card txcard">
  <header class=wk-txh><div><b>Redelegate</b><span id=txn hidden></span></div><span class=txlockn id=txlockn></span><span class=txsum id=txsum></span></header>
  <div class=txans id=txans></div>
  <div class=txlist id=txlist></div>
  <div class=txlock id=txlock></div>
  <div class=txfee id=txfee></div>
  <div class=txstep id=txstep></div>
  <div class=txbtns><button class="wk-btn wk-bell" id=txbell type=button title="Alerts for these validators"><svg viewBox="0 0 24 24" aria-hidden=true><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>Alerts</button><button class="wk-btn wk-go" id=txsign type=button>Redelegate</button></div>
</div></div>

<div class=pop id=unpop><div class="card txcard uncard">
  <header class=wk-txh><div><b>Unstake</b><span>{{CHAIN_ID}}</span></div><span class=txsum id=unsum></span></header>
  <div class=unpick id=unpick></div>
  <div class=unamt>
    <div class="wk-field unfield"><input class=wk-amt2 id=unamt type=text inputmode=decimal placeholder="amount" autocomplete=off spellcheck=false aria-label="ATONE to unstake"><button class=wk-max id=unmax type=button title="Everything on this validator">max <b id=unmaxv>-</b></button></div>
    <span class=unhint id=unhint></span>
  </div>
  <div class=txlock id=unlock></div>
  <div class=txfee id=unfee></div>
  <div class=txstep id=unstep></div>
  <div class=txbtns><button class=wk-btn id=uncancel type=button>Cancel</button><button class="wk-btn wk-go" id=unsign type=button disabled>Unstake</button></div>
</div></div>

<div class=pop id=clpop><div class="card txcard uncard clcard" role=dialog aria-modal=true aria-labelledby=clttl>
  <header class=wk-txh><div><b id=clttl>Claim rewards</b><span>{{CHAIN_ID}}</span></div><span class=txsum id=clsum></span></header>
  <div class=unpick id=clpick></div>
  <div class=txfee id=clfee></div>
  <div class=txstep id=clstep></div>
  <div class=txbtns><button class="wk-btn wk-go" id=clsign type=button disabled>Claim</button></div>
</div></div>

<div class=pop id=stpop><div class="card txcard uncard stcard">
  <header class=wk-txh><div><b>Stake</b><span>{{CHAIN_ID}}</span></div><span class=txsum id=stsum></span></header>
  <div class="unamt sttop">
    <div class="wk-field unfield"><input class=wk-amt2 id=stamt type=text inputmode=decimal placeholder="amount" autocomplete=off spellcheck=false aria-label="ATONE to stake"><button class=wk-max id=stmax type=button title="Every liquid ATONE">max <b id=stmaxv>-</b></button></div>
    <span class=wk-seln id=stseln aria-live=polite></span>
    <span class=unhint id=sthint></span>
  </div>
  <div class="wk-tbl2 stlist" id=stlist></div>
  <div class=txlock id=stlock></div>
  <div class=txfee id=stfee></div>
  <div class=txstep id=ststep></div>
  <div class=txbtns><button class="wk-btn wk-bell" id=stbell type=button title="Alerts for these validators"><svg viewBox="0 0 24 24" aria-hidden=true><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>Alerts</button><button class="wk-btn wk-go" id=stsign type=button disabled>Stake</button></div>
</div></div>

<div class=pop id=atpop><div class="card txcard uncard atcard" role=dialog aria-modal=true aria-labelledby=atttl data-v=setup>
  <header class=wk-txh><div><b id=atttl>Autopilot</b><span>{{CHAIN_ID}}</span></div><span class=txsum id=atsum></span></header>
  <!-- a phone shows one side at a time; a wide window shows both -->
  <div class=atview role=tablist aria-label="Autopilot">
    <button type=button role=tab id=atvs aria-controls=atL aria-selected=true data-v=setup>Setup</button>
    <button type=button role=tab id=atvv aria-controls=atR aria-selected=false tabindex=-1 data-v=vals>Validators <b id=atvn></b></button>
  </div>
  <div class=atbody>
    <section class=atL id=atL aria-labelledby=atttl>
      <div class=atstate id=atstate hidden></div>
      <div class=atidle id=atidle hidden></div>
      <div class=atform id=atform>
        <div class=atrow><span class=atlab><i>2</i>Validators<small>which validators it may use</small></span>
          <div class="atpre at2">
            <label class=atpc><input type=radio name=atpick value=auto checked><b>Autopilot</b><em id=atna></em><small class=atd>the best-paying, never jailed</small></label>
            <label class=atpc><input type=radio name=atpick value=selected><b>Choose yourself</b><em id=atn2></em><small class=atd>you pick each one</small></label>
          </div></div>
        <div class=atrow><span class=atlab><i>3</i>Stake<small>optional cap on what it may move; empty for no cap</small></span>
          <div class="wk-field unfield atfield"><input class=wk-amt2 id=atcap type=text inputmode=decimal placeholder="no cap" autocomplete=off spellcheck=false aria-label="ATONE the keeper may move in total"><button class=wk-max id=atmax type=button title="Everything that can move">max <b id=atmaxv>-</b></button></div>
          <span class=unhint id=athint></span></div>
      </div>
      <ul class=bn id=atwhat><li><i class=bn-ic><svg viewBox="0 0 24 24" aria-hidden=true><circle cx="12" cy="12" r="8"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg></i><span class=bn-t><b>Keeps your stake in the active set</b><small><b id=atidlen>Stake</b> sits idle on inactive validators today</small></span></li><li><i class=bn-ic><svg viewBox="0 0 24 24" aria-hidden=true><path d="M4 17l5-5 4 4 7-8"/><path d="M15 8h5v5"/></svg></i><span class=bn-t><b>Keeps your APR at its best</b><small>moves only for 5 APR points or more</small></span></li><li><i class=bn-ic><svg viewBox="0 0 24 24" aria-hidden=true><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/></svg></i><span class=bn-t><b>Redelegates, nothing else</b><small>GATA funds your pilot, no fees for you</small></span></li></ul>
      <div class=atnote><svg viewBox="0 0 24 24" aria-hidden=true><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg><span>Runs every <b>12 hours</b>, you can revoke anytime.</span></div>
    </section>
    <section class=atR id=atR aria-label="Select your validators">
      <div class=atrs><input class=atfind id=atfind type=search placeholder="Find by name or operator key" aria-label="Find a validator" autocomplete=off spellcheck=false><span class=wk-seln id=atcount aria-live=polite></span></div>
      <div class=atlist id=atlist></div>
    </section>
  </div>
  <div class=atfoot>
    <div class=atfs><div class=txfee id=attxfee></div><div class=txstep id=atstep></div></div>
    <div class=txbtns><button class=wk-btn id=atcancel type=button hidden>Back</button><button class="wk-btn wk-danger" id=atrevoke type=button hidden>Revoke</button><button class=wk-btn id=atedit type=button hidden>Change</button><button class="wk-btn wk-go" id=atgrant type=button disabled>Activate</button></div>
  </div>
</div></div>

<div class=pop id=rspop><div class="card txcard uncard rscard" role=dialog aria-modal=true aria-labelledby=rsttl>
  <header class=wk-txh><div><b id=rsttl>Restake</b><span>{{CHAIN_ID}}</span></div><span class=txsum id=rssum></span></header>
  <div class=rsbody>
    <ul class=bn><li><i class=bn-ic><svg viewBox="0 0 24 24" aria-hidden=true><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg></i><span class=bn-t><b>Compounds your rewards</b><small><b id=rsadd>your rewards</b> more a year</small></span></li><li><i class=bn-ic><svg viewBox="0 0 24 24" aria-hidden=true><path d="M5 20V10M10 20V6M15 20v-8M20 20V4"/></svg></i><span class=bn-t><b>Into the best-paying validator</b><small>not back onto the same one</small></span></li><li><i class=bn-ic><svg viewBox="0 0 24 24" aria-hidden=true><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/></svg></i><span class=bn-t><b>Claims and stakes, nothing else</b><small>GATA funds your restake, no fees for you</small></span></li></ul>
    <div class=atnote><svg viewBox="0 0 24 24" aria-hidden=true><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg><span>Runs every <b>12 hours</b>, minimum 1 ATONE, you can revoke anytime.</span></div>
  </div>
  <div class=rsfoot><button class="wk-btn wk-go" id=rsgo type=button>Activate</button></div>
</div></div>

<div class=pop id=ipop><div class="card vcard icard">
  <div class="vhead vwrap"><span class=vmono id=imono></span>
    <div class=vcol><div class=vname><span class=vnm id=iname>-</span></div><div class=vsub><span class=iop id=iop></span></div></div></div>
  <div class=vbadges id=ibadges></div>
  <p class=inote id=inote></p>
  <div class=vgrid>
    <div class=vstat><span class=vk>your stake</span><span class=vv id=imine>-</span></div>
    <div class=vstat><span class=vk>APR now</span><span class=vv style="color:var(--burn)">0%</span></div>
    <div class=vstat><span class=vk>ATONE staked</span><span class=vv id=istake>-</span></div>
    <div class=vstat><span class=vk>commission</span><span class=vv id=icomm>-</span></div>
  </div>
</div></div>

<div class=pop id=apop><div class="card vcard acard">
  <div class="vhead vwrap"><img class=vlogo id=alogo alt=""><span class=vmono id=amono></span>
    <div class=vcol><div class=vname><span class=vnm id=aval>-</span></div></div></div>
  <div class=amany id=amany hidden></div>
  <div class=alist>
    <label class=aopt><input type=checkbox data-f=d checked>
      <span>Stops signing<i>misses 10 blocks in a row</i></span></label>
    <label class=aopt><input type=checkbox data-f=h>
      <span>Misses half the slashing window<i>5,000 of 10,000 blocks, jailed at 9,500</i></span></label>
    <label class=aopt><input type=checkbox data-f=j>
      <span>Jailed<i>dropped out of the active set</i></span></label>
    <label class=aopt><input type=checkbox data-f=r>
      <span>Rank changes<i>moves 2 places or more</i></span></label>
    <label class=aopt><input type=checkbox data-f=t>
      <span>APR moves &plusmn;10%</span></label>
  </div>
  <a class=tgbtn id=tgbtn target=_blank rel="noopener noreferrer"><svg viewBox="0 0 24 24"
    aria-hidden=true><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8
    l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.35-.1-.55-.6-.2L6.2 13.1 1.4
    11.6c-1-.3-1-1 .2-1.5l19-7.3c.85-.3 1.6.2 1.3 1.5z"/></svg>Continue in Telegram</a>
  <div class=amore id=amore hidden></div>
  <div class=vnote>Subscribe again to change your choices.<br>/list shows every validator you watch and its alerts.<br>/stop stops all validators, /stop &lt;name&gt; stops one validator.</div>
</div></div>

<div class=pop id=gpop><div class="card vcard gcard">
  <svg id=trendbig viewBox="0 0 900 300" role=img aria-label="Top-ten proposal share, zoomable"></svg>
</div></div>

<div class=pop id=hist><div class="card vcard hcard">
  <div class=vhead>
    <div class=vhid><div class=vname>Historical <span class=lc>&eta;</span></div></div>
  </div>
  <div class="scroll hscroll"><table class=htab><thead><tr>
    <th>week</th><th>date</th><th><span class=lc>η</span></th><th>even reward</th>
    <th>C</th></tr></thead>
    <tbody>{{SCHEDULE}}</tbody></table></div>
  <div class=vnote>Tap any row for detail. Rows past today are projections.</div>
</div></div>

<div class=pop id=pop><div class="card vcard">
  <div class=vhead>
    <div class=vhid><div class=vname><span class="ptag te">week <b id=popw>-</b></span></div></div>
  </div>
  <div class=vgrid>
    <div class="vstat hot"><span class=vk><span class=lc>&eta;</span></span><span class=vv id=pope>-</span></div>
    <div class=vstat><span class=vk>date</span><span class=vv id=popd>-</span></div>
    <div class=vstat><span class=vk>even reward</span><span class=vv id=popp>-</span></div>
    <div class=vstat><span class=vk>by stake</span><span class=vv id=popb>-</span></div>
    <div class=vstat><span class=vk>flat share each</span><span class=vv id=popf>-</span></div>
    <div class=vstat><span class=vk>opening block</span><span class=vv id=popbk>-</span></div>
  </div>
  
</div></div>

<script id=payload type=application/json>{{DATA}}</script>
<script src="tx.js"></script>
<script src="app.js"></script>
<script src="simple.js"></script>
<script src="shell.js"></script>
</body></html>
