(()=>{
const pages=document.getElementById('phonePages'),app=document.getElementById('app');if(!pages||!app)return;
const KEY='calculator-installed-v36',ID='account';
function set(){try{return new Set(JSON.parse(localStorage.getItem(KEY)||'[]'))}catch{return new Set()}}
function installed(){return set().has(ID)}
function addCatalog(){const c=window.CalculatorProApps?.catalog;if(!Array.isArray(c)||c.some(x=>x.id===ID))return;c.unshift({id:ID,name:'Apple Account',icon:'👤',cls:'account-app',desc:'Optional Calculator account and app sync',kind:'account'});}
function sync(){addCatalog();const icon=pages.querySelector('.calculator-account-launch');if(icon)icon.style.display=installed()?'':'none';}
app.addEventListener('click',e=>{const row=e.target.closest?.('.store-row');if(!row||e.target.closest('.store-get'))return;const name=row.querySelector('.store-meta strong')?.textContent?.trim();if(name!=='Apple Account'||!installed())return;e.preventDefault();e.stopImmediatePropagation();window.CalculatorAccount?.open?.()},true);
new MutationObserver(sync).observe(pages,{childList:true,subtree:true});window.addEventListener('calculator-home-rendered',()=>setTimeout(sync,0));setInterval(sync,1200);setTimeout(sync,100);
})();