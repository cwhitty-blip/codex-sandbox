(()=>{
// Calculator/Home load first. Phone, Contacts and Messages load afterward.
// The old call-ring layer is intentionally disabled because browser testing proved it could lock the UI.
const VERSION='26';
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
async function start(){
  try{
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',8000);
    await loadScript('./phone-system.js?v='+VERSION,5000);
    await loadScript('./message-launcher.js?v='+VERSION,5000);
    await loadScript('./phone-polish.js?v='+VERSION,5000);
    window.dispatchEvent(new CustomEvent('calculator-communications-ready'));
  }catch(err){
    console.warn('Calculator communications unavailable',err);
    window.__calculatorCommunicationsUnavailable=true;
  }
}
setTimeout(start,250);
})();