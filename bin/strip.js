/* strip.js - the copy of a script the site serves, without its comments. The comments are this repository's working
   notes; a reader's browser needs only the program. Node's own parser (acorn, inside node) finds every comment and each
   is cut: a comment alone on its line(s) goes with its line, one at a line's end goes with the spaces before it, one
   between two tokens leaves a space - or a line break when it held one, since automatic semicolons depend on line
   breaks. Both texts are then parsed again and the copy is written only when they are the same syntax tree; anything
   else (a parse error, a different tree, the parser missing) exits non-zero and render.py serves the original.
     node --expose-internals strip.js <in.js> <out.js> */
"use strict";
const fs = require("fs");
const acorn = require("internal/deps/acorn/acorn/dist/acorn");
const [src, dst] = process.argv.slice(2);
const code = fs.readFileSync(src, "utf8"), O = { ecmaVersion: "latest", sourceType: "script", allowHashBang: true };
const cuts = [];
acorn.parse(code, Object.assign({ onComment: (block, text, start, end) => cuts.push([start, end]) }, O));
let out = "", at = 0;
const sp = c => c === " " || c === "\t";
for(const [a, b] of cuts){
  let ps = a; while(ps > at && sp(code[ps - 1])) ps--;
  let qe = b; while(qe < code.length && sp(code[qe])) qe++;
  const lineStart = ps === 0 || code[ps - 1] === "\n", lineEnd = qe === code.length || code[qe] === "\n" || code[qe] === "\r";
  out += code.slice(at, ps);
  if(lineStart && lineEnd) at = code[qe] === "\r" ? qe + 2 : qe + 1;
  else if(lineEnd) at = qe;
  else { out += code.slice(a, b).includes("\n") ? "\n" : " "; at = qe; }
}
out += code.slice(at);
const tree = s => JSON.stringify(acorn.parse(s, O), (k, v) => k === "start" || k === "end" ? undefined : typeof v === "bigint" ? "bigint:" + v : v);
if(tree(code) !== tree(out)){ console.error("strip.js: " + src + ": the copy is not the same program"); process.exit(2); }
fs.writeFileSync(dst, out);
