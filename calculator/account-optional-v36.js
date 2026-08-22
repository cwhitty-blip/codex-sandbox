(()=>{
const pages=document.getElementById('phonePages'),app=document.getElementById('app');if(!pages||!app)return;
const KEY='calculator-installed-v36',ID='account';
function installed(){try{return new Set(JSON.parse(localStorage.getItem(KEY)||'[]')).has(ID)}catch{return false}}
function addCatalog(){const c=window.CalculatorProApps?.catalog;if(!Array.isArray(c)||c.some(x=>x.id===ID))return; c.unshift({id:ID,name:'Account',icon:'👤',cls:'account-app',desc:'Apple-style Calculator Account',kind:'external-account'});}
function icon(){const b=document.createElement('button');b.type='button';b.className='phone-app calculator-account-launch';b.innerHTML='<span class="phone-icon account-app">👤</span><span class="phone-label">Account</span>';b.onclick=()=>window.CalculatorAccount?.open?.();return b}
function sync(){addCatalog();const old=pages.querySelector('.calculator-account-launch');if(!installed()){old?.remove();return}if(old)return;const grids=pages.querySelectorAll('.phone-grid');const target=grids[1]||grids[0];target?.append(icon())}
app.addEventListener('click',e=>{const row=e.target.closest?.('.store-row');if(!row||e.target.closest('.store-get'))return;const name=row.querySelector('.store-meta strong')?.textContent?.trim();if(name!=='Account')return;if(!installed())return;e.preventDefault();e.stopImmediatePropagation();window.CalculatorAccount?.open?.()},true);
new MutationObserver(sync).observe(pages,{childList:true,subtree:true});window.addEventListener('calculator-home-rendered',()=>setTimeout(sync,0));setInterval(sync,1500);setTimeout(sync,100);
})();