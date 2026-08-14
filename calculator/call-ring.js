(()=>{
if(!(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true))return;
let ctx=null,ringTimer=null,vibeTimer=null,active=false;
function ensureAudio(){try{ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume()}catch{}}
['touchstart','pointerdown','click'].forEach(ev=>document.addEventListener(ev,ensureAudio,{once:true,passive:true}));
function tone(freq,duration=.18,delay=0){if(!ctx)return;const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(0.0001,ctx.currentTime+delay);g.gain.exponentialRampToValueAtTime(.22,ctx.currentTime+delay+.02);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+delay+duration);o.connect(g).connect(ctx.destination);o.start(ctx.currentTime+delay);o.stop(ctx.currentTime+delay+duration+.03)}
function ringPattern(){ensureAudio();tone(880,.18,0);tone(660,.22,.22);tone(880,.18,.5);tone(660,.22,.72)}
function startRing(){if(active)return;active=true;ringPattern();ringTimer=setInterval(ringPattern,2100);try{navigator.vibrate?.([500,250,500,250,500])}catch{}vibeTimer=setInterval(()=>{try{navigator.vibrate?.([500,250,500])}catch{}},2200);maybeNotify()}
function stopRing(){active=false;if(ringTimer)clearInterval(ringTimer);if(vibeTimer)clearInterval(vibeTimer);ringTimer=vibeTimer=null;try{navigator.vibrate?.(0)}catch{}}
async function maybeNotify(){if(!('Notification'in window)||Notification.permission!=='granted'||!document.hidden)return;try{new Notification('Calculator Call',{body:'Incoming Calculator call',tag:'calculator-call',renotify:true})}catch{}}
function polishOverlay(o){if(!o||o.dataset.ringPolished==='1')return;const incoming=o.querySelector('#accept')&&o.querySelector('#decline');if(!incoming)return;o.dataset.ringPolished='1';const small=o.querySelector('.call-small');if(small)small.textContent='Calculator Call';const name=o.querySelector('.call-name');const status=o.querySelector('.call-status');if(status&&!/Calculator/.test(status.textContent))status.textContent='Incoming Calculator call';startRing();o.addEventListener('click',e=>{if(e.target.closest('#accept,#decline'))stopRing()},{capture:true});}
const mo=new MutationObserver(()=>{const o=document.getElementById('calcCallOverlay');if(o)polishOverlay(o);else stopRing()});mo.observe(document.body,{childList:true,subtree:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)maybeNotify()});
})();