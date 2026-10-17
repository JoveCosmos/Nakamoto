/* console.js - the app as an engineer sees it in DevTools: every console message, uncaught error, failed or
   4xx/5xx request and Chrome "Issue" (the Issues tab) while the page loads and walks every route.
     node --experimental-websocket dev/console.js [--url URL] [--size 1440x900] [--phone] [--wallet] [--addr ATONE1...]
                                                 [--wait MS] [--settle MS] [--verbose] [--clicks] [routes...]
   --phone emulates a touch phone at --size (default 390x844). --verbose adds Chrome's verbose lines (violations).
   --clicks then opens what a reader opens on each route - every action button, validator row and card - one at a
   time, and closes it again (never a sign, send or faucet button). The stand-in wallet carries the address's real
   public key read from the chain, so the app's fee simulations behave as they do for that wallet.
   Routes default to every one in shell.json. Exit code 1 when anything at warning level or above was seen.
   Needs google-chrome. */
const { spawn } = require("child_process"), fs = require("fs"), path = require("path"), os = require("os");
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); if(i < 0) return null; const v = A[i + 1]; A.splice(i, 2); return v; };
const flag = k => { const i = A.indexOf(k); if(i < 0) return false; A.splice(i, 1); return true; };
const URL0 = opt("--url") || "http://127.0.0.1:8089", PHONE = flag("--phone");
const SIZE = (opt("--size") || (PHONE ? "390x844" : "1440x900")).split("x").map(Number);
const WAIT = +(opt("--wait") || 2500), SETTLE = +(opt("--settle") || 8000), VERBOSE = flag("--verbose"), CLICKS = flag("--clicks");
const ADDR0 = opt("--addr"), ADDR = ADDR0 || "atone14y3usgepvcxxs6jkjqwhuyjy6eyhu7rkvpg2a7", WALLET = flag("--wallet") || !!ADDR0;
const shell = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "shell.json"), "utf8"));
const ROUTES = A.length ? A : shell.sections.flatMap(s => (s.sub || []).filter(v => !v.off).map(v => s.route + "/" + v.route));
const PORT = 9300 + Math.floor(Math.random() * 500), dir = fs.mkdtempSync(path.join(os.tmpdir(), "console-"));
const chrome = spawn("google-chrome", ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + dir, "about:blank"], { stdio: "ignore", detached: true });
/* the browser and its profile go on every exit (see phone.js): Chrome runs in its own process group */
let gone = false;
function teardown(){ if(gone) return; gone = true;
  try{ process.kill(-chrome.pid, "SIGKILL"); }catch(e){ try{ chrome.kill("SIGKILL"); }catch(e2){} }
  try{ fs.rmSync(dir, { recursive: true, force: true }); }catch(e){} }
process.on("exit", teardown);
for(const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => { teardown(); process.exit(130); });
process.on("uncaughtException", e => { console.error(e); teardown(); process.exit(1); });
process.on("unhandledRejection", e => { console.error(e); teardown(); process.exit(1); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* a stand-in Keplr that only reads; it cannot sign */
const API = /\/testnet\b/.test(URL0) ? "https://atomone-testnet-api.gatadao.com" : "https://atomone-api.gatadao.com";
const mock = pk => `window.keplr={enable:function(){return Promise.resolve()},getKey:function(){return Promise.resolve({name:"demo",bech32Address:"${ADDR}",pubKey:new Uint8Array([${pk.join(",")}])})},signDirect:function(){return Promise.reject(new Error("no"))},signAmino:function(){return Promise.reject(new Error("no"))}};
addEventListener("load",function(){setTimeout(function(){ if(window.__wconnect) window.__wconnect("Keplr"); },300);});`;
async function pubKey(){ try{ const d = await (await fetch(API + "/cosmos/auth/v1beta1/accounts/" + ADDR)).json();
    let a = d.account || {}; while(a && !a.pub_key && (a.base_account || a.base_vesting_account)) a = a.base_account || a.base_vesting_account;
    if(a && a.pub_key && a.pub_key.key) return [...Buffer.from(a.pub_key.key, "base64")]; }catch(e){}
  console.error("note: no public key on chain for " + ADDR + " - fee simulations will be refused"); return new Array(33).fill(0); }
/* what a reader opens, by route: buttons and rows by selector, visible ones only, never anything that signs or sends */
const OPENERS = [["[data-act]:not([data-act=faucet]):not([data-act=grsend]):not([data-act=vote])", 30], ["#protabs .l2tab", 6], ["[data-v]", 2], ["tr.vrow[data-v]", 2],
  ["[data-gv]", 2], [".gp-r,.gpx-r", 2], [".qm", 2], [".sv-chip[data-route],.sv-vr[data-route]", 2], [".cell,.vbar", 1], [".etapt", 1], [".actabs button", 3]];
const SKIP = /sign|send|faucet|disconnect|log ?out|revoke|turn off|stop/i;
const seen = [], where = { route: "load" }, nodes = [], opened = {};
const short = u => String(u || "").replace(URL0, "").slice(0, 160);
function add(kind, level, text, src){ text = String(text).replace(/\s+/g, " ").trim().slice(0, 400);
  const key = kind + "|" + level + "|" + text + "|" + (src || "");
  const old = seen.find(s => s.key === key); if(old){ old.n++; if(!old.routes.includes(where.route)) old.routes.push(where.route); return; }
  seen.push({ key, kind, level, text, src: src || "", n: 1, routes: [where.route] }); }
function argText(a){ if(!a) return ""; if(a.type === "string") return a.value; if(a.value !== undefined) return JSON.stringify(a.value);
  return a.description || a.className || a.type; }
async function clickAll(r, send){
  const list = await send("Runtime.evaluate", { returnByValue: true, expression: `(function(){ var o = [], seen = {}, n = 0;
    ${JSON.stringify(OPENERS)}.forEach(function(g){ var took = 0;
      document.querySelectorAll(g[0]).forEach(function(e){ if(took >= g[1]) return; var b = e.getBoundingClientRect(), cs = getComputedStyle(e);
        if(b.width < 2 || b.height < 2 || cs.visibility === "hidden" || e.closest(".pop:not(.on)") || e.disabled || e.hasAttribute("data-cx")) return;
        var t = (e.getAttribute("aria-label") || e.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40), k = (e.dataset.act || "") + "|" + t;
        if(seen[k] || ${SKIP}.test(t)) return; seen[k] = 1; took++; var i = n++; e.setAttribute("data-cx", String(i)); o.push({ i: i, t: t || e.dataset.act || e.className }); }); });
    return o; })()` });
  const items = (list.result && list.result.result && list.result.result.value) || [];
  opened[r] = items.slice(0, 40).map(it => it.t);
  for(const it of items.slice(0, 40)){ where.route = r + " > " + it.t;
    await send("Runtime.evaluate", { userGesture: true, expression: `(function(){ var e = document.querySelector('[data-cx="${it.i}"]'); if(e) e.click(); })()` });
    await sleep(WAIT);
    await send("Runtime.evaluate", { userGesture: true, expression: "window.__POP && window.__POP.closeAll(); window.__undock && window.__undock();" });
    await send("Runtime.evaluate", { userGesture: true, expression: `window.__shellGo && window.__shellGo(${JSON.stringify(r)})` });
    await sleep(400); }
  where.route = r;
}
(async () => {
  let tgt = null; for(let k = 0; k < 50 && !tgt; k++){ await sleep(150); try{ const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); tgt = l.find(t => t.type === "page"); }catch(e){} }
  if(!tgt){ console.error("chrome did not start"); process.exit(1); }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); let id = 0; const pend = {}, reqs = {};
  ws.onmessage = m => { const d = JSON.parse(m.data);
    if(d.id && pend[d.id]){ pend[d.id](d); delete pend[d.id]; return; }
    const p = d.params || {};
    if(d.method === "Runtime.consoleAPICalled"){
      const lvl = p.type === "warning" ? "warning" : p.type === "error" || p.type === "assert" ? "error" : p.type;
      const fr = p.stackTrace && p.stackTrace.callFrames && p.stackTrace.callFrames[0];
      add("console", lvl, (p.args || []).map(argText).join(" "), fr ? short(fr.url) + ":" + (fr.lineNumber + 1) : "");
    } else if(d.method === "Runtime.exceptionThrown"){
      const x = p.exceptionDetails || {};
      add("exception", "error", (x.exception && x.exception.description || x.text || "").split("\n").slice(0, 2).join(" | "), short(x.url) + ":" + ((x.lineNumber || 0) + 1));
    } else if(d.method === "Log.entryAdded"){
      const e = p.entry || {};
      if(e.level === "verbose" && !VERBOSE) return;
      add("log:" + e.source, e.level, e.text, short(e.url) + (e.lineNumber != null ? ":" + (e.lineNumber + 1) : ""));
    } else if(d.method === "Network.requestWillBeSent"){
      reqs[p.requestId] = { url: p.request.url, method: p.request.method, type: p.type };
    } else if(d.method === "Network.responseReceived"){
      const r = p.response || {}; if(reqs[p.requestId]) reqs[p.requestId].status = r.status;
      if(r.status >= 400) add("http", r.status >= 500 ? "error" : "warning", r.status + " " + (reqs[p.requestId] ? reqs[p.requestId].method : "") + " " + short(r.url), p.type);
    } else if(d.method === "Network.loadingFailed"){
      const r = reqs[p.requestId] || {};
      if(p.canceled && !p.blockedReason) return;   /* the app aborting its own superseded fetch is not shown by DevTools */
      add("netfail", "error", (p.errorText || "") + (p.blockedReason ? " blocked:" + p.blockedReason : "") + (p.corsErrorStatus ? " cors:" + p.corsErrorStatus.corsError : "") + " " + (r.method || "") + " " + short(r.url), p.type);
    } else if(d.method === "Audits.issueAdded"){
      const is = p.issue || {}, det = is.details || {};
      const inner = Object.values(det)[0] || {};
      const bits = [inner.code || inner.errorType || inner.violationType || inner.genericIssueErrorType || inner.type || inner.deprecationIssueDetails || "",
        inner.request && inner.request.url ? short(inner.request.url) : "", inner.blockedURL ? short(inner.blockedURL) : "",
        inner.sourceCodeLocation ? short(inner.sourceCodeLocation.url) + ":" + (inner.sourceCodeLocation.lineNumber + 1) : "",
        inner.violatingNodeAttribute || ""].filter(Boolean);
      /* a form issue names one element: described by its tag, id, name, class and the start of its markup */
      if(inner.violatingNodeId) nodes.push(send("DOM.describeNode", { backendNodeId: inner.violatingNodeId }).then(r => { const n = r.result && r.result.node; if(!n) return;
        const at = {}; for(let k = 0; k < (n.attributes || []).length; k += 2) at[n.attributes[k]] = n.attributes[k + 1];
        add("issue", "issue", is.code + " " + bits.join(" ") + " <" + n.localName + Object.entries(at).filter(([k]) => /^(id|name|type|class|data-[a-z]+|aria-label|value)$/.test(k)).map(([k, v]) => " " + k + "=" + JSON.stringify(String(v).slice(0, 40))).join("") + ">", ""); }).catch(() => {}));
      else add("issue", "issue", is.code + " " + bits.join(" "), "");
    } };
  await new Promise(r => ws.onopen = r);
  const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; const t = setTimeout(() => { delete pend[i]; j(new Error(method + " timed out")); }, 25000);
    pend[i] = d => { clearTimeout(t); r(d); }; ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable"); await send("Network.enable"); await send("DOM.enable"); await send("Audits.enable");
  if(VERBOSE) await send("Log.startViolationsReport", { config: [{ name: "longTask", threshold: 200 }, { name: "longLayout", threshold: 30 }, { name: "blockedEvent", threshold: 100 }, { name: "handler", threshold: 150 }, { name: "recurringHandler", threshold: 50 }] });
  if(PHONE){ await send("Emulation.setDeviceMetricsOverride", { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }); }
  else await send("Emulation.setDeviceMetricsOverride", { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  if(WALLET) await send("Page.addScriptToEvaluateOnNewDocument", { source: mock(await pubKey()) });
  await send("Page.navigate", { url: URL0 + "/" }); await sleep(SETTLE);
  for(const r of ROUTES){ where.route = r;
    /* as a reader's click (userGesture): a history entry added without one is marked skippable by Chrome */
    try{ await send("Runtime.evaluate", { expression: `window.__shellGo && window.__shellGo(${JSON.stringify(r)})`, userGesture: true }); }catch(e){ add("tool", "error", "route " + r + ": " + e.message); }
    await sleep(WAIT);
    if(CLICKS) await clickAll(r, send); }
  where.route = "idle"; await sleep(SETTLE); await Promise.all(nodes);
  const n = { error: 0, warning: 0, issue: 0, other: 0 };
  for(const s of seen) n[s.level in n ? s.level : "other"] += 1;
  console.log(`${URL0} ${SIZE.join("x")}${PHONE ? " phone" : ""}${WALLET ? " wallet" : ""}: ${n.error} error, ${n.warning} warning, ${n.issue} issue, ${n.other} other (distinct)`);
  const order = { error: 0, warning: 1, issue: 2 };
  seen.sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3));
  for(const s of seen) console.log(`  [${s.level}] ${s.kind} x${s.n} ${s.text}${s.src ? "  @ " + s.src : ""}  (${s.routes.slice(0, 4).join(", ")}${s.routes.length > 4 ? ", +" + (s.routes.length - 4) : ""})`);
  for(const r in opened) console.log(`  opened on ${r} (${opened[r].length}): ${opened[r].join(" | ").slice(0, 600)}`);
  teardown(); process.exit(n.error + n.warning ? 1 : 0);
})();
