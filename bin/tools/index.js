/* the index: two tiles, each with a small live picture of its tool */
(function(){
"use strict";
var T = window.T;
var a = T.stage(T.E("cv1"), function(c, w, h, t){
  var teal = T.tok("--teal"), bar = T.tok("--bar"), red = T.tok("--red"), cx = w * .62, cy = h * .55;
  for(var i = 0; i < 7; i++){ var ang = t * .35 + i * Math.PI * 2 / 7, r = 34 + 7 * Math.sin(t * 1.3 + i), x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * .7;
    c.strokeStyle = bar; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke();
    c.fillStyle = i % 3 === 0 ? red : teal; c.beginPath(); c.arc(x, y, 3.2, 0, 7); c.fill(); }
  c.fillStyle = teal; c.beginPath(); c.arc(cx, cy, 6, 0, 7); c.fill();
});
var b = T.stage(T.E("cv2"), function(c, w, h, t){
  var teal = T.tok("--teal"), bar = T.tok("--bar"), vio = T.tok("--violet2"), x0 = w * .22, y0 = h * .55;
  for(var i = 0; i < 4; i++){ var x1 = w * .78, y1 = h * (.2 + i * .22);
    c.strokeStyle = bar; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(w * .5, y0, w * .5, y1, x1, y1); c.stroke();
    var p = (t * .5 + i * .25) % 1, px = x0 + (x1 - x0) * p, py = y0 + (y1 - y0) * (3 * p * p - 2 * p * p * p);
    c.fillStyle = i % 2 ? vio : teal; c.beginPath(); c.arc(px, py, 3, 0, 7); c.fill();
    c.fillStyle = bar; c.beginPath(); c.arc(x1, y1, 4, 0, 7); c.fill(); }
  c.fillStyle = teal; c.beginPath(); c.arc(x0, y0, 6, 0, 7); c.fill();
});
/* gather: many sources flowing into one */
var g = T.stage(T.E("cv3"), function(c, w, h, t){
  var teal = T.tok("--teal"), bar = T.tok("--bar"), vio = T.tok("--violet2"), x1 = w * .78, y1 = h * .55;
  for(var i = 0; i < 4; i++){ var x0 = w * .22, y0 = h * (.2 + i * .22);
    c.strokeStyle = bar; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(w * .5, y0, w * .5, y1, x1, y1); c.stroke();
    var p = (t * .5 + i * .25) % 1, px = x0 + (x1 - x0) * p, py = y0 + (y1 - y0) * (3 * p * p - 2 * p * p * p);
    c.fillStyle = i % 2 ? vio : teal; c.beginPath(); c.arc(px, py, 3, 0, 7); c.fill();
    c.fillStyle = bar; c.beginPath(); c.arc(x0, y0, 4, 0, 7); c.fill(); }
  c.fillStyle = teal; c.beginPath(); c.arc(x1, y1, 6, 0, 7); c.fill();
});
a.start(); b.start(); g.start();
window.addEventListener("tools:theme", function(){ a.redraw(); b.redraw(); g.redraw(); });
})();
