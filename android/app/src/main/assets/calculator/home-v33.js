(()=>{
const pages=document.getElementById('phonePages'),dots=document.getElementById('pageDots'),home=document.getElementById('home');if(!pages||!home)return;
function decorate(){
 const apps=[...pages.querySelectorAll('.phone-app')];
 apps.forEach(a=>{
  const label=a.querySelector('.phone-label')?.textContent?.trim()||'';
  if(label==='Ava'){a.querySelector('.phone-icon')?.classList.add('ava')}
  if(label==='Messages'||label==='Secret Message'){
   let unread=0;try{unread=Number(localStorage.getItem('calculator-unread-count')||0)}catch{}
   a.classList.toggle('has-badge',unread>0);if(unread>0)a.dataset.badge=unread>99?'99+':String(unread)
  }
  a.setAttribute('aria-label',label||'App');
 });
}
function currentPage(){return Math.max(0,Math.round(pages.scrollLeft/Math.max(1,pages.clientWidth)))}
function syncDots(){const n=currentPage();[...dots.children].forEach((d,i)=>d.classList.toggle('active',i===n))}
pages.addEventListener('scroll',()=>requestAnimationFrame(syncDots),{passive:true});
pages.addEventListener('pointerup',e=>{const a=e.target.closest('.phone-app');if(!a)return;a.animate?.([{transform:'scale(.9)'},{transform:'scale(1)'}],{duration:150,easing:'cubic-bezier(.2,.8,.2,1)'})});
let lastTap=0;home.addEventListener('click',e=>{if(e.target.closest('.phone-app,.phone-dock,.status-lock'))return;const now=Date.now();if(now-lastTap<330){pages.scrollTo({left:0,behavior:'smooth'})}lastTap=now});
window.addEventListener('calculator-home-rendered',()=>setTimeout(()=>{decorate();syncDots()},0));
new MutationObserver(()=>requestAnimationFrame(decorate)).observe(pages,{subtree:true,childList:true});
decorate();syncDots();
})();