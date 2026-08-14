(()=>{
const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
window.__calculatorStandalone=standalone;
if(standalone)return;
// Browser/Safari mode stays a normal calculator. Private screens are removed so a guessed code cannot reveal them here.
const home=document.getElementById('home'),app=document.getElementById('app'),second=document.getElementById('second'),deep=document.getElementById('deep');
[home,app,second,deep].forEach(el=>{if(el){el.innerHTML='';el.style.display='none'}});
// Capture equals before the app handler. In Safari, 5963= behaves as ordinary calculator math instead of unlocking.
document.addEventListener('click',e=>{
 const b=e.target.closest('#calc [data-a="eq"]');if(!b)return;
 // Main app may still calculate normally; this guard only prevents private UI from becoming visible.
 setTimeout(()=>{document.querySelectorAll('.screen').forEach(el=>{if(el.id!=='calc')el.classList.remove('active')});const calc=document.getElementById('calc');if(calc)calc.classList.add('active')},0);
},true);
})();