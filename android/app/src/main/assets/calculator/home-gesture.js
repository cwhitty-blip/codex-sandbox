(()=>{
if(!(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true))return;
const home=document.getElementById('home');
if(!home)return;
let startY=0,startX=0,tracking=false;
const indicator=document.createElement('div');
indicator.id='privateHomeIndicator';
indicator.style.cssText='position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 5px);transform:translateX(-50%);width:132px;height:5px;border-radius:99px;background:#fff;box-shadow:0 1px 3px #0006;z-index:10000;opacity:0;pointer-events:none;transition:opacity .18s';
document.body.append(indicator);
function activePrivate(){return [...document.querySelectorAll('.screen.active')].find(x=>x.id==='app'||x.id==='second'||x.id==='deep')}
function updateIndicator(){indicator.style.opacity=activePrivate()?'0.9':'0'}
new MutationObserver(updateIndicator).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
function goHome(){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));home.classList.add('active');window.dispatchEvent(new CustomEvent('calculator-private-home'));updateIndicator()}
addEventListener('touchstart',e=>{if(!activePrivate()||!e.touches.length)return;const t=e.touches[0];if(t.clientY<innerHeight-55)return;tracking=true;startY=t.clientY;startX=t.clientX},{passive:true});
addEventListener('touchmove',e=>{if(!tracking||!e.touches.length)return;const t=e.touches[0];const dy=startY-t.clientY,dx=Math.abs(t.clientX-startX);if(dy>75&&dy>dx*1.25){tracking=false;goHome()}},{passive:true});
addEventListener('touchend',()=>tracking=false,{passive:true});
addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||!activePrivate())return;if(e.clientY<innerHeight-35)return;tracking=true;startY=e.clientY;startX=e.clientX});
addEventListener('pointermove',e=>{if(!tracking||e.pointerType==='touch')return;const dy=startY-e.clientY,dx=Math.abs(e.clientX-startX);if(dy>70&&dy>dx*1.25){tracking=false;goHome()}});
addEventListener('pointerup',()=>tracking=false);
updateIndicator();
})();