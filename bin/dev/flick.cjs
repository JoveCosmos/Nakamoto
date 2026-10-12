// Flicker scan: for each route (and popup), sample the size of every visible panel, card and popup every 200 ms for
// 9 s after it appears, and report what changes size after it first rendered. Read-only, mock wallet.
const { spawn } = require("child_process"), fs = require("fs"), os = require("os"), path = require("path");
const BASE = "http://127.0.0.1:8089", ADDR = process.argv[2], PHONE = process.argv[3] === "phone";
const MOCK = `window.keplr={enable:()=>Promise.resolve(),getKey:()=>Promise.resolve({name:"Scan",bech32Address:"${ADDR}",isNanoLedger:false,pubKey:new Uint8Array(33)}),
 signAmino:()=>new Promise(()=>{}),signDirect:()=>new Promise(()=>{})};
addEventListener("load",()=>setTimeout(()=>window.__wconnect&&window.__wconnect("Keplr"),300));`;
// what is watched: the boxes a reader sees resize
const WATCH = `[...document.querySelectorAll('.sv-panel,.sv-card,.panel,.sec,.wk-pane,.you,.you-apr,.sd-col,.sv-ph,.pop.on .card,.pop.on .txfee,.pop.on .mtout,.pop.on .unout,.atcard,.gp-vote,.mv-hl,.sd-strip')].filter(e=>e.offsetParent||e.closest('.pop.on'))`;
const SNAP = `(()=>{const o={};${WATCH}.forEach((e,i)=>{const r=e.getBoundingClientRect();const id=(e.id?'#'+e.id:'')+'.'+String(e.className).split(' ').slice(0,2).join('.')+'@'+i;o[id]=[Math.round(r.width),Math.round(r.height),(e.innerText||'').slice(0,40).replace(/\\s+/g,' ')];});return JSON.stringify(o)})()`;
const ROUTES = [["/dashboard/wallet"], ["/dashboard/self"], ["/staking/bonus"], ["/staking/trend"], ["/staking/picks"], ["/network/uptime"], ["/network/signing"],
  ["/network/proposers"], ["/network/activity"], ["/network/economics"], ["/governance/proposals"], ["/governance/governors"], ["/governance/core-daos"], ["/dashboard/governance"],
  ["/dashboard/wallet", "document.querySelector('[data-act=mint]')&&document.querySelector('[data-act=mint]').click()", "mint popup"],
  ["/dashboard/wallet", "(()=>{const b=[...document.querySelectorAll('button')].find(b=>/Activate Autopilot/.test(b.textContent)&&b.offsetParent);b&&b.click()})()", "autopilot popup"],
  ["/dashboard/wallet", "document.querySelector('.wact')&&document.querySelector('.wact').click()", "activity popup"],
  ["/dashboard/self", "(()=>{const t=document.querySelector('#pro-stake');t&&t.click()})()", "pro stake tab"]];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (const [route, act, label] of ROUTES) {
    const PORT = 9300 + Math.floor(Math.random() * 600), prof = fs.mkdtempSync(path.join(os.tmpdir(), "fl-"));
    const chrome = spawn("google-chrome", ["--headless=new", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=" + PORT, "--user-data-dir=" + prof, "about:blank"], { stdio: "ignore", detached: true });
    try {
      let t = null; for (let k = 0; k < 60 && !t; k++) { await sleep(150); try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(x => x.type === "page"); } catch (e) {} }
      const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pend = {};
      ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
      await new Promise(r => ws.onopen = r);
      const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
      const ev = async js => { const r = await cmd("Runtime.evaluate", { expression: js, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : null; };
      await cmd("Emulation.setDeviceMetricsOverride", { width: PHONE ? 390 : 1440, height: PHONE ? 844 : 900, deviceScaleFactor: 1, mobile: PHONE });
      await cmd("Page.enable"); await cmd("Page.addScriptToEvaluateOnNewDocument", { source: MOCK });
      await cmd("Page.navigate", { url: BASE + route });
      if (act) { await sleep(9000); await ev(act); }
      const first = {}, last = {}, changes = {};
      for (let k = 0; k < 45; k++) {
        await sleep(200);
        const o = JSON.parse(await ev(SNAP) || "{}");
        for (const [key, v] of Object.entries(o)) {
          if (!v[1]) continue;                                   // not yet laid out
          if (!first[key]) { first[key] = v; continue; }
          const p = last[key] || first[key];
          if (Math.abs(p[0] - v[0]) > 2 || Math.abs(p[1] - v[1]) > 2) (changes[key] = changes[key] || []).push(`${p[0]}x${p[1]} -> ${v[0]}x${v[1]} "${v[2]}"`);
          last[key] = v;
        }
      }
      const keys = Object.keys(changes);
      console.log(`${label || route}: ${keys.length ? keys.length + " resized" : "stable"}`);
      keys.slice(0, 8).forEach(k => console.log("   " + k.slice(0, 60) + "  " + changes[k].slice(0, 2).join(" | ")));
    } catch (e) { console.log(route, "FAIL", e.message); } finally { try { process.kill(-chrome.pid, "SIGKILL"); } catch (e) {} fs.rmSync(prof, { recursive: true, force: true }); }
  }
})();
