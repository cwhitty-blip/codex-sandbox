(()=>{
const params=new URL(location.href).searchParams;
const appFlag=params.get('app')==='1';
const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true||appFlag;
window.__calculatorStandalone=standalone;
if(standalone)return;
const privateIds=['home','app','second','deep'];
privateIds.forEach(id=>{const el=document.getElementById(id);if(el){el.style.display='none';el.setAttribute('aria-hidden','true')}});
function forceCalculator(){
 document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
 const calc=document.getElementById('calc');if(calc)calc.classList.add('active');
 privateIds.forEach(id=>{const el=document.getElementById(id);if(el){el.style.display='none';el.setAttribute('aria-hidden','true')}});
}
document.addEventListener('click',e=>{
 const eq=e.target.closest?.('#calc [data-a="eq"]');if(!eq)return;
 const display=document.getElementById('disp');const pin=localStorage.getItem('main-code')||'5963';
 if(display?.textContent.trim()!==pin)return;
 e.preventDefault();e.stopImmediatePropagation();forceCalculator();
},true);
new MutationObserver(()=>{if(privateIds.some(id=>document.getElementById(id)?.classList.contains('active')))forceCalculator()}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
})();