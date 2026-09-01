(()=>{
let last=Date.now(),timer=null;const IDLE=120000;
function touch(){last=Date.now()}
['pointerdown','keydown','touchstart','scroll'].forEach(e=>document.addEventListener(e,touch,{passive:true}));
function stopMedia(){document.querySelectorAll('video,audio').forEach(m=>{try{m.pause()}catch{};try{const s=m.srcObject;if(s?.getTracks)s.getTracks().forEach(t=>t.stop())}catch{}});document.querySelectorAll('iframe[src*="youtube"]').forEach(f=>f.remove())}
function lock(){stopMedia();window.CalculatorPrivatePhotos?.stopCamera?.();window.CalculatorCore?.lock?.()}
function check(){if(document.hidden)return;if(!document.getElementById('calc')?.classList.contains('active')&&Date.now()-last>IDLE)lock()}
timer=setInterval(check,15000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)lock();else touch()});window.addEventListener('pagehide',lock);
const harden=()=>document.querySelectorAll('input,textarea').forEach(x=>{x.autocomplete='off';x.autocapitalize=x.autocapitalize||'sentences';x.spellcheck=false});new MutationObserver(harden).observe(document.body,{childList:true,subtree:true});harden();
})();