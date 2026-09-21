/* before paint: no default pane should ever flash */
try{var _t=localStorage.getItem("th_tab");
 if(_t==="home"||_t==="eta"||_t==="pays"||_t==="dele"||_t==="intro") document.documentElement.setAttribute("data-tab",_t);
 if(localStorage.getItem("th_mono")==="1") document.documentElement.setAttribute("data-mono","1");
 /* day or night: the reader's own choice first, else what the browser prefers */
 var _th=localStorage.getItem("th_theme");
 if(_th!=="light"&&_th!=="dark") _th=(window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";
 document.documentElement.setAttribute("data-theme",_th);
}catch(e){}

/* the calculator pane's box, remembered from the last visit, so a page that opens on the
   dashboard sits where the calculator sits before the calculator has been laid out */
try{ var cb = (localStorage.getItem("th_calcbox") || "").split("/");
  if(cb.length === 3 && +cb[2] === innerWidth && +cb[1] > 100){ document.documentElement.style.setProperty("--calc-top", cb[0] + "px"); document.documentElement.style.setProperty("--calc-h", cb[1] + "px"); } }catch(e){}
