(()=>{
if(!(window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true))return;
const home=document.getElementById('home'),app=document.getElementById('app');if(!home||!app)return;
let retrying=false;
document.addEventListener('click',e=>{
 const b=e.target.closest?.('.phone-app');if(!b||retrying)return;
 const label=b.querySelector('.phone-label')?.textContent?.trim();
 if(label!=='Contacts'&&label!=='Secret Message'&&label!=='Phone')return;
 const wasHome=home.classList.contains('active');if(!wasHome)return;
 setTimeout(()=>{
  if(!home.classList.contains('active'))return;
  document.getElementById('calcCallOverlay')?.remove();document.body.style.pointerEvents='';document.documentElement.style.pointerEvents='';
  retrying=true;try{if(typeof b.onclick==='function')b.onclick.call(b,new MouseEvent('click',{bubbles:false,cancelable:true}));else b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))}catch{}finally{setTimeout(()=>retrying=false,80)}
 },120);
},false);
})();