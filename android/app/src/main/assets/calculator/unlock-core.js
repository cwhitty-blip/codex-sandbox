(()=>{
const calc=document.getElementById('calc');
const display=document.getElementById('disp');
const home=document.getElementById('home');
if(!calc||!display||!home)return;
function appMode(){return window.__calculatorStandalone===true||matchMedia('(display-mode: standalone)').matches||navigator.standalone===true||new URL(location.href).searchParams.get('app')==='1'}
function pin(){return localStorage.getItem('main-code')||'5963'}
function unlock(event){
 if(!appMode())return false;
 if(display.textContent.trim()!==pin())return false;
 event?.preventDefault?.();event?.stopImmediatePropagation?.();
 // Home is rendered once when app.js starts. Do not call renderPhone here; rebuilding it on unlock was causing iOS freezes.
 document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
 calc.classList.remove('active');
 home.style.display='';home.removeAttribute('aria-hidden');home.classList.add('active');
 display.textContent='0';
 window.dispatchEvent(new CustomEvent('calculator-private-home'));
 return true;
}
document.addEventListener('pointerup',e=>{
 const key=e.target.closest?.('#calc .key');if(!key)return;
 if(key.dataset.v==='+'||key.dataset.a==='eq')unlock(e);
},true);
document.addEventListener('click',e=>{
 const key=e.target.closest?.('#calc .key');if(!key)return;
 if(key.dataset.v==='+'||key.dataset.a==='eq')unlock(e);
},true);
window.CalculatorUnlock={unlock};
})();