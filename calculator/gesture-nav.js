(()=>{
const home=document.getElementById('home'),app=document.getElementById('app'),second=document.getElementById('second'),deep=document.getElementById('deep');
if(!home||!app)return;
let startX=0,startY=0,lastY=0,tracking=false,target=null;
function show(el){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));el.classList.add('active')}
function goHome(){show(home);home.dispatchEvent(new Event('private-home-return'))}
function attach(el){el.addEventListener('touchstart',e=>{if(!el.classList.contains('active')||!e.touches.length)return;const t=e.touches[0];if(t.clientY<innerHeight-120)return;startX=t.clientX;startY=t.clientY;lastY=t.clientY;tracking=true;target=el},{passive:true});el.addEventListener('touchmove',e=>{if(!tracking||target!==el||!e.touches.length)return;lastY=e.touches[0].clientY},{passive:true});el.addEventListener('touchend',()=>{if(!tracking||target!==el)return;const dy=startY-lastY,dx=Math.abs(startX-(event.changedTouches?.[0]?.clientX||startX));tracking=false;target=null;if(dy>85&&dx<130){if(el===app)goHome();else if(el===deep)show(second);else if(el===second)goHome()}},{passive:true})}
[app,second,deep].forEach(attach);
function bar(){if(document.getElementById('privateHomeBar'))return;const b=document.createElement('div');b.id='privateHomeBar';b.setAttribute('aria-hidden','true');document.body.append(b)}
bar();
new MutationObserver(()=>{const b=document.getElementById('privateHomeBar');if(!b)return;b.classList.toggle('visible',app.classList.contains('active')||second.classList.contains('active')||deep.classList.contains('active'))}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
})();