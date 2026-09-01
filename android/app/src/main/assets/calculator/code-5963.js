(()=>{
// Initialize the original Calculator unlock code once.  Do not overwrite a
// passcode changed through Settings on every reload.
if(!localStorage.getItem('main-code'))localStorage.setItem('main-code','5963');
})();
