(()=>{
if(!(window.__calculatorStandalone===true||window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true))return;
let ctx=null,ringTimer=null,active=false,lastIncoming=false;
function ensureAudio(){try{ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume().catch(()=>{})}catch{}}
function tone(freq,start,duration){if(!ctx)return;try{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=freq;const t=ctx.currentTime+start;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.13,t+.018);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+duration+.03)}catch{}}
function pattern(){ensureAudio();tone(740,0,.16);tone(900,.22,.18);tone(740,.52,.16);tone(900,.74,.18);try{navigator.vibrate?.([350,180,350])}catch{}}
function start(){if(active)return;active=true;pattern();ringTimer=setInterval(pattern,2100)}
function stop(){if(!active)return;active=false;if(ringTimer)clearInterval(ringTimer);ringTimer=null;try{navigator.vibrate?.(0)}catch{}}
function check(){const o=document.getElementById('calcCallOverlay');const incoming=!!(o&&o.querySelector('#accept')&&o.querySelector('#decline'));if(incoming&&!lastIncoming)start();if(!incoming&&lastIncoming)stop();lastIncoming=incoming}
['pointerdown','touchstart','click'].forEach(type=>document.addEventListener(type,ensureAudio,{once:true,passive:true}));
document.addEventListener('click',e=>{if(e.target.closest?.('#accept,#decline,#callEnd'))stop()},{capture:true});
setInterval(check,280);
window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else setTimeout(check,80)});
})();