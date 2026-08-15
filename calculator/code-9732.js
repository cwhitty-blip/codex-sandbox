(()=>{
const migration='calculator-code-9732-v1';
if(localStorage.getItem(migration)!=='1'){
  localStorage.setItem('main-code','9732');
  localStorage.setItem(migration,'1');
}
})();