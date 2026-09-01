(()=>{
if(!window.__calculatorStandalone)return;
const original=window.matchMedia?.bind(window);
if(!original)return;
window.matchMedia=query=>{
 const result=original(query);
 if(String(query).trim()==='(display-mode: standalone)'){
  return new Proxy(result,{get(target,prop){if(prop==='matches')return true;const value=Reflect.get(target,prop,target);return typeof value==='function'?value.bind(target):value}});
 }
 return result;
};
})();