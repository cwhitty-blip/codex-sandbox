(()=>{
// Keep Calculator and the Home Screen independent from the network-based calling stack.
// Communications load after the core UI is already usable, so a slow CDN cannot freeze startup.
const VERSION='25';
function loadScript(src,timeout=9000){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    let done=false;
    const finish=(ok,err)=>{if(done)return;done=true;clearTimeout(timer);ok?resolve():reject(err||new Error('Script failed: '+src))};
    const timer=setTimeout(()=>finish(false,new Error('Timed out: '+src)),timeout);
    s.src=src;s.async=false;
    s.onload=()=>finish(true);
    s.onerror=()=>finish(false);
    document.head.appendChild(s);
  });
}
function toast(m){const t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1400)}
async function start(){
  try{
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',8000);
    await loadScript('./phone-system.js?v='+VERSION,5000);
    await loadScript('./message-launcher.js?v='+VERSION,5000);
    await loadScript('./phone-polish.js?v='+VERSION,5000);
    await loadScript('./call-ring.js?v='+VERSION,5000);
    window.dispatchEvent(new CustomEvent('calculator-communications-ready'));
  }catch(err){
    console.warn('Calculator communications unavailable',err);
    // Core phone stays usable even when the calling network cannot load.
    window.__calculatorCommunicationsUnavailable=true;
  }
}
// Give Calculator/Home first paint and input priority.
setTimeout(start,250);
})();