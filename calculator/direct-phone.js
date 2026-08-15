(()=>{
const calc=document.getElementById('calc');
const home=document.getElementById('home');
const disp=document.getElementById('disp');
if(!home)return;
window.__calculatorStandalone=true;
function openPhoneHome(){
 document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
 if(calc){calc.classList.remove('active');calc.style.display='none'}
 if(disp)disp.textContent='0';
 home.style.display='';
 home.removeAttribute('aria-hidden');
 home.classList.add('active');
 window.dispatchEvent(new CustomEvent('calculator-private-home'));
}
openPhoneHome();
window.addEventListener('pageshow',openPhoneHome);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(openPhoneHome,0)});
const lock=document.getElementById('phoneLock');
if(lock){lock.textContent='Home';lock.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openPhoneHome()},true)}
window.DirectPhoneMode={openHome:openPhoneHome};
})();