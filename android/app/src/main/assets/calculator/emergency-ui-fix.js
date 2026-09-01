(()=>{
if(!(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true))return;
const home=document.getElementById('home'),pages=document.getElementById('phonePages');if(!home||!pages)return;
let lastCleanup=0;
function stopMedia(root){try{root?.querySelectorAll('video,audio').forEach(el=>{const s=el.srcObject;if(s?.getTracks)s.getTracks().forEach(t=>t.stop());el.srcObject=null})}catch{}}
function cleanup(force=false){const now=Date.now();if(!force&&now-lastCleanup<250)return;lastCleanup=now;
 const activeCall=document.getElementById('calcCallOverlay');
 // Only remove call overlays automatically when Home is the active screen. During a real active call, leave it alone.
 if(home.classList.contains('active')&&activeCall){stopMedia(activeCall);activeCall.remove()}
 if(home.classList.contains('active')){const sm=document.getElementById('smRemoteMedia');if(sm){stopMedia(sm);sm.remove()}}
 document.documentElement.style.pointerEvents='';document.body.style.pointerEvents='';
 document.documentElement.style.touchAction='';document.body.style.touchAction='';
 home.style.pointerEvents='auto';pages.style.pointerEvents='auto';
 home.classList.remove('home-editing');
 pages.querySelectorAll('.dragging-app').forEach(x=>x.classList.remove('dragging-app'));
 pages.querySelectorAll('.phone-app').forEach(x=>{x.style.pointerEvents='auto';x.draggable=false});
 try{navigator.vibrate?.(0)}catch{}
}
function homeVisible(){return home.classList.contains('active')}
new MutationObserver(()=>{if(homeVisible())setTimeout(()=>cleanup(true),0)}).observe(home,{attributes:true,attributeFilter:['class']});
window.addEventListener('calculator-private-home',()=>cleanup(true));
window.addEventListener('pageshow',()=>setTimeout(()=>cleanup(true),50));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&homeVisible())setTimeout(()=>cleanup(true),80)});
// If a stale invisible layer is intercepting a touch, clean it before the click is dispatched.
['pointerdown','touchstart'].forEach(type=>pages.addEventListener(type,e=>{if(!homeVisible())return;const app=e.target.closest?.('.phone-app');if(app)cleanup(false)},{capture:true,passive:true}));
// Safety: any overlay that has been left around after Home becomes active is removed after a short grace period.
setInterval(()=>{if(homeVisible())cleanup(false)},1200);
cleanup(true);
})();