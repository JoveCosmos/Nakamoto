/* phone.js - the app on a real phone viewport (Chrome's own device emulation over the DevTools
   protocol; a headless window cannot go below 500 px). For each route: what spills past the screen's
   sides, what text a non-scrolling box cuts, and a full-page screenshot.
     node --experimental-websocket dev/phone.js [--url URL] [--size 390x844] [--out DIR] [--wallet] [--addr ATONE1...] [routes...]
   Routes default to every one in shell.json. Needs google-chrome. */
const { spawn } = require("child_process"), fs = require("fs"), path = require("path"), os = require("os");
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); if(i < 0) return null; const v = A[i + 1]; A.splice(i, 2); return v; };
const URL0 = opt("--url") || "http://127.0.0.1:8089", SIZE = (opt("--size") || "390x844").split("x").map(Number), OUT = opt("--out");
const EVAL = opt("--eval"), WAIT = +(opt("--wait") || 0);
const ADDR = opt("--addr") || "atone14y3usgepvcxxs6jkjqwhuyjy6eyhu7rkvpg2a7";
const WALLET = A.includes("--wallet") || ADDR !== "atone14y3usgepvcxxs6jkjqwhuyjy6eyhu7rkvpg2a7"; if(A.includes("--wallet")) A.splice(A.indexOf("--wallet"), 1);
const VP = A.includes("--vp"); if(VP) A.splice(A.indexOf("--vp"), 1);
const DARK = A.includes("--dark"); if(DARK) A.splice(A.indexOf("--dark"), 1);
const shell = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "shell.json"), "utf8"));
const ROUTES = A.length ? A : shell.sections.flatMap(s => (s.sub || []).filter(v => !v.off).map(v => s.route + "/" + v.route));
const PORT = 9300 + Math.floor(Math.random() * 500), dir = fs.mkdtempSync(path.join(os.tmpdir(), "phone-"));
const chrome = spawn("google-chrome", ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--remote-debugging-port=" + PORT, "--user-data-dir=" + dir,
  ...(DARK ? ["--force-dark-mode"] : []), "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MOCK = `window.keplr={enable:function(){return Promise.resolve()},getKey:function(){return Promise.resolve({name:"demo",bech32Address:"${ADDR}",pubKey:new Uint8Array(33)})},signDirect:function(){return Promise.reject(new Error("no"))}};
addEventListener("load",function(){setTimeout(function(){ if(window.__wconnect) window.__wconnect("Keplr"); },300);});`;
const AUDIT = `(function(){
  /* the phone's own width, not innerWidth: a page wider than the phone zooms out and widens innerWidth */
  var W=DEVW, H=innerHeight, side=[], cut=[];
  function scrollsX(a){ var s=getComputedStyle(a).overflowX; return (s==='auto'||s==='scroll') && a.scrollWidth>a.clientWidth+1; }
  function ownText(e){ for(var n=e.firstChild;n;n=n.nextSibling) if(n.nodeType===3&&n.nodeValue.trim()) return n.nodeValue.trim(); return ''; }
  var all=document.body.getElementsByTagName('*');
  for(var i=0;i<all.length;i++){ var e=all[i]; if(e.closest('.pop:not(.on),script,style')) continue;
    var cs=getComputedStyle(e); if(cs.visibility==='hidden'||cs.display==='none') continue;
    var r=e.getBoundingClientRect(); if(r.width<1||r.height<1) continue;
    var a=e.parentElement, inX=false, clipX=null; while(a&&a!==document.body){ if(scrollsX(a)){inX=true;break;} var ox=getComputedStyle(a).overflowX; if(!clipX&&(ox==='hidden'||ox==='clip')) clipX=a; a=a.parentElement; }
    var t=ownText(e);
    if(!inX && (r.right>W+1||r.left<-1)){
      var vis = !clipX || (function(c){ var cr=c.getBoundingClientRect(); return r.right>cr.right+1||r.left<cr.left-1 ? 'clipped' : ''; })(clipX);
      side.push((e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+String(e.className).split(' ')[0])+(t?' "'+t.slice(0,30)+'"':'')+' x '+Math.round(r.left)+'..'+Math.round(r.right)+(vis==='clipped'?' (cut)':''));
    }
    if(t){ var b=e.parentElement; while(b&&b!==document.documentElement){ var bs=getComputedStyle(b), oy=bs.overflowY;
        if((oy==='auto'||oy==='scroll')&&b.scrollHeight>b.clientHeight+1) break;
        if(oy==='hidden'||oy==='clip'){ var br=b.getBoundingClientRect(); if(r.bottom>br.bottom+2){ cut.push((e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+String(e.className).split(' ')[0])+' "'+t.slice(0,30)+'" by '+(b.id?'#'+b.id:String(b.className).split(' ')[0])); } break; }
        b=b.parentElement; } }
  }
  var se=document.scrollingElement;
  return JSON.stringify({W:W,H:H,docW:se.scrollWidth,docH:se.scrollHeight,side:side.slice(0,12),nside:side.length,cut:cut.slice(0,10),ncut:cut.length});
})()`;
(async () => {
  let tgt = null; for(let k = 0; k < 50 && !tgt; k++){ await sleep(150); try{ const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); tgt = l.find(t => t.type === "page"); }catch(e){} }
  if(!tgt){ console.error("chrome did not start"); chrome.kill(); process.exit(1); }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); let id = 0; const pend = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if(d.id && pend[d.id]){ pend[d.id](d); delete pend[d.id]; } };
  await new Promise(r => ws.onopen = r);
  /* every call answers within 25 s or fails, so one stuck page cannot stall the run */
  const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; const t = setTimeout(() => { delete pend[i]; j(new Error(method + " timed out")); }, 25000);
    pend[i] = d => { clearTimeout(t); r(d); }; ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  if(WALLET) await send("Page.addScriptToEvaluateOnNewDocument", { source: MOCK });
  /* load once, then move the way the app does (its router): a section opened by URL may land on its
     first view by design, and a wallet connect resets the dashboard to its first view */
  await send("Page.navigate", { url: URL0 + "/" }); await sleep(WALLET ? 6000 : 3000);
  for(const r of ROUTES){ try{
    await send("Runtime.evaluate", { expression: `window.__shellGo && window.__shellGo(${JSON.stringify(r)})` });
    await send("Runtime.evaluate", { expression: "window.scrollTo(0,0)" });
    await sleep(WAIT || 1800);
    const res = await send("Runtime.evaluate", { expression: AUDIT.replace("DEVW", String(SIZE[0])), returnByValue: true });
    if(!res.result || !res.result.result || res.result.result.value == null){ console.log(`${SIZE.join("x")} ${r} : audit failed ` + JSON.stringify(res.result && res.result.exceptionDetails || res.error || "").slice(0, 200)); continue; }
    const v = JSON.parse(res.result.result.value);
    if(EVAL){ const x = await send("Runtime.evaluate", { expression: EVAL, returnByValue: true }); console.log("    EVAL " + JSON.stringify(x.result && x.result.result && x.result.result.value)); }
    console.log(`${SIZE.join("x")} ${r} : side=${v.nside} cut=${v.ncut} docW=${v.docW}/${v.W}` + (v.nside ? "\n    SIDE " + v.side.join("\n    SIDE ") : "") + (v.ncut ? "\n    CUT " + v.cut.join("\n    CUT ") : ""));
    /* the page as a phone shows it, top to bottom - capped at 4000 css px (the constitution is a book) */
    /* the page as a phone shows it: one screen at a time, scrolled (a capture beyond the viewport
       renders the part below it dimmed), up to five screens; name_0.png, name_1.png, ... */
    if(OUT){ const n = VP ? 1 : Math.min(5, Math.ceil(v.docH / v.H));
      for(let k = 0; k < n; k++){
        await send("Runtime.evaluate", { expression: `window.scrollTo(0, ${k * v.H})` }); await sleep(350);
        const s = await send("Page.captureScreenshot", { format: "png" });
        if(s.result && s.result.data) fs.writeFileSync(path.join(OUT, r.replace("/", "_") + "_" + k + ".png"), Buffer.from(s.result.data, "base64")); }
      await send("Runtime.evaluate", { expression: "window.scrollTo(0,0)" }); }
  }catch(e){ console.log(`${SIZE.join("x")} ${r} : error ${e && e.message}`); } }
  ws.close(); chrome.on("exit", () => { try{ fs.rmSync(dir, { recursive: true, force: true }); }catch(e){} }); chrome.kill();
})();
