(()=>{
const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
if(!installed)return;
const display=document.getElementById('disp');
const home=document.getElementById('home');
if(!display||!home)return;
document.addEventListener('click',event=>{
 const key=event.target.closest('#calc [data-v="+"]');
 if(!key)return;
 const pin=localStorage.getItem('main-code')||'5963';
 if(display.textContent.trim()!==pin)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
 display.textContent='0';
 home.classList.add('active');
 window.dispatchEvent(new CustomEvent('calculator-private-home'));
},true);
})();