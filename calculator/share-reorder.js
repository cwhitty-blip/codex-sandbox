(()=>{
if(!(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true))return;
const INSTALL='https://cwhitty-blip.github.io/codex-sandbox/calculator/install.html';
const pages=document.getElementById('phonePages'),home=document.getElementById('home'),toastEl=document.getElementById('toast');if(!pages||!home)return;
let edit=false,drag=null,hold=null,startX=0,startY=0,edgeTimer=null,edgeDir=0;
function toast(m){toastEl.textContent=m;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),1200)}
function labelOf(el){return el?.querySelector('.phone-label')?.textContent?.trim()||''}
function keyOf(el){return labelOf(el).toLowerCase().replace(/[^a-z0-9]+/g,'-')}
async function share(){const data={title:'Calculator',text:'Add Calculator to your iPhone Home Screen:',url:INSTALL};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(INSTALL);toast('Install link copied')}}catch(e){if(e?.name!=='AbortError')toast('Could not open Share')}}
function shareIcon(){const b=document.createElement('button');b.className='phone-app share-calculator-app';b.innerHTML='<span class="phone-icon share-icon">↗</span><span class="phone-label">Share Calculator</span>';b.onclick=share;return b}
function injectShare(){if(pages.querySelector('.share-calculator-app'))return;const grids=pages.querySelectorAll('.phone-grid');const g=grids[1]||grids[0];if(g)g.append(shareIcon())}
function savedOrder(){try{return JSON.parse(localStorage.getItem('phone-app-order')||'[]')}catch{return[]}}
function saveOrder(){const arr=[];pages.querySelectorAll('.phone-page').forEach((p,pi)=>p.querySelectorAll('.phone-grid>.phone-app').forEach((el,oi)=>arr.push({key:keyOf(el),page:pi,order:oi})));localStorage.setItem('phone-app-order',JSON.stringify(arr))}
function applyOrder(){const order=savedOrder();if(!order.length)return;const byKey=new Map([...pages.querySelectorAll('.phone-grid>.phone-app')].map(el=>[keyOf(el),el]));order.sort((a,b)=>a.page-b.page||a.order-b.order).forEach(x=>{const el=byKey.get(x.key),grid=pages.querySelectorAll('.phone-grid')[x.page];if(el&&grid)grid.append(el)})}
function setEdit(on){edit=on;home.classList.toggle('home-editing',on);if(on)toast('Drag apps to move them')}
function currentPageIndex(){return Math.max(0,Math.round(pages.scrollLeft/pages.clientWidth))}
function currentGrid(){return pages.querySelectorAll('.phone-grid')[currentPageIndex()]||pages.querySelector('.phone-grid')}
function moveAt(el,x,y){const grid=currentGrid();if(!grid)return;const others=[...grid.children].filter(c=>c!==el);let before=null,best=Infinity;for(const o of others){const r=o.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,d=(cx-x)**2+(cy-y)**2;if(d<best){best=d;before=o}}if(before)grid.insertBefore(el,before);else grid.append(el)}
function stopEdge(){if(edgeTimer)clearInterval(edgeTimer);edgeTimer=null;edgeDir=0}
function edgeScroll(x){const margin=46,dir=x<margin?-1:x>innerWidth-margin?1:0;if(!dir){stopEdge();return}if(edgeDir===dir&&edgeTimer)return;stopEdge();edgeDir=dir;edgeTimer=setInterval(()=>{const max=pages.querySelectorAll('.phone-page').length-1,now=currentPageIndex(),next=Math.max(0,Math.min(max,now+edgeDir));if(next===now)return;pages.scrollTo({left:next*pages.clientWidth,behavior:'smooth'});setTimeout(()=>{if(drag)currentGrid()?.append(drag)},260)},620)}
pages.addEventListener('pointerdown',e=>{const el=e.target.closest('.phone-app');if(!el)return;startX=e.clientX;startY=e.clientY;hold=setTimeout(()=>{drag=el;setEdit(true);el.classList.add('dragging-app');try{el.setPointerCapture(e.pointerId)}catch{}},520)});
pages.addEventListener('pointermove',e=>{if(hold&&Math.hypot(e.clientX-startX,e.clientY-startY)>12){clearTimeout(hold);hold=null}if(!drag)return;e.preventDefault();edgeScroll(e.clientX);moveAt(drag,e.clientX,e.clientY)});
function end(){if(hold)clearTimeout(hold);hold=null;stopEdge();if(drag){drag.classList.remove('dragging-app');drag=null;saveOrder()}}
pages.addEventListener('pointerup',end);pages.addEventListener('pointercancel',end);
pages.addEventListener('click',e=>{if(edit&&e.target.closest('.phone-app')){e.preventDefault();e.stopImmediatePropagation()}},true);
document.addEventListener('click',e=>{if(edit&&!e.target.closest('.phone-app'))setEdit(false)});
const obs=new MutationObserver(()=>{injectShare();requestAnimationFrame(applyOrder)});obs.observe(pages,{childList:true,subtree:true});injectShare();requestAnimationFrame(applyOrder);
})();