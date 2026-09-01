(()=>{
if(window.__calculatorAndroid!==true||!window.CalculatorAndroid)return;
const pages=document.getElementById('phonePages');
if(!pages)return;
function add(){
 if(pages.querySelector('.calculator-secure-lab'))return;
 const grid=pages.querySelector('.phone-grid');
 if(!grid)return;
 const button=document.createElement('button');
 button.type='button';
 button.className='phone-app calculator-secure-lab';
 button.innerHTML='<span class="phone-icon" style="background:linear-gradient(145deg,#19243d,#326cff);color:#fff">🔒</span><span class="phone-label">Secure Lab</span>';
 button.onclick=()=>window.CalculatorAndroid.openSecureMessagingLab();
 grid.append(button);
}
new MutationObserver(add).observe(pages,{childList:true,subtree:true});
window.addEventListener('calculator-home-rendered',()=>setTimeout(add,0));
add();
})();
