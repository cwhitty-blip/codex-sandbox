(()=>{
// Core UI loads immediately; communications attach just after first paint.
// Android keeps this layer off until native pairing, delivery, and review gates pass.
if(window.__calculatorCommunicationsDisabled===true){window.__calculatorCommunicationsUnavailable=true;return}
const VERSION='45';
function loadScript(src,timeout=8000){return new Promise((resolve,reject)=>{const s=document.createElement('script');let done=false;const finish=(ok,err)=>{if(done)return;done=true;clearTimeout(timer);ok?resolve():reject(err||new Error('Script failed: '+src))};const timer=setTimeout(()=>finish(false,new Error('Timed out: '+src)),timeout);s.src=src;s.async=false;s.onload=()=>finish(true);s.onerror=()=>finish(false);document.head.appendChild(s)})}
async function start(){try{await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',7000);await loadScript('./calculator/realtime-send-fix.js?v='+VERSION,2500);await loadScript('./calculator/webrtc-fix-v36.js?v='+VERSION,2500);await loadScript('./calculator/phone-system.js?v='+VERSION,4000);await loadScript('./calculator/message-launcher.js?v='+VERSION,4000);await loadScript('./calculator/phone-polish.js?v='+VERSION,4000);await loadScript('./calculator/phone-keypad-fix.js?v='+VERSION,2500);await loadScript('./calculator/call-ring-safe.js?v='+VERSION,2500);window.dispatchEvent(new CustomEvent('calculator-communications-ready'))}catch(err){console.warn('Calculator communications unavailable',err);window.__calculatorCommunicationsUnavailable=true}}
setTimeout(start,60);
})();
