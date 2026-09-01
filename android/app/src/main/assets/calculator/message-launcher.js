(()=>{
if(!(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true))return;
const pages=document.getElementById('phonePages');if(!pages)return;
function make(){const b=document.createElement('button');b.className='phone-app secret-message-launch';b.innerHTML='<span class="phone-icon messages-icon">●</span><span class="phone-label">Secret Message</span>';return b}
function inject(){if(pages.querySelector('.secret-message-launch'))return;const grids=pages.querySelectorAll('.phone-grid');const g=grids[1]||grids[0];if(g)g.prepend(make())}
new MutationObserver(inject).observe(pages,{childList:true,subtree:true});inject();
})();