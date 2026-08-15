(()=>{
const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
window.__calculatorStandalone=standalone;
if(standalone)return;
// Safari/browser mode is always an ordinary calculator. Remove private screens entirely.
const home=document.getElementById('home'),app=document.getElementById('app'),second=document.getElementById('second'),deep=document.getElementById('deep');
[home,app,second,deep].forEach(el=>{if(el){el.innerHTML='';el.style.display='none'}});
// The main calculator historically tried to open the private Home Screen on PIN + equals.
// In Safari that Home Screen does not exist, which caused the apparent freeze. Block only
// that exact unlock attempt; all other calculator operations continue normally.
document.addEventListener('click',e=>{
 const eq=e.target.closest?.('#calc [data-a="eq"]');
 if(!eq)return;
 const display=document.getElementById('disp');
 const pin=localStorage.getItem('main-code')||'5963';
 if(display?.textContent.trim()!==pin)return;
 e.preventDefault();
 e.stopImmediatePropagation();
 // 5963 = behaves as a harmless no-op in normal Calculator mode.
 display.textContent=pin;
},true);
})();