import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.addInitScript(()=>{
  localStorage.setItem('main-code','5963');
  localStorage.setItem('calculator-installed-v36','["account"]');
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',route=>route.fulfill({
  status:200,
  contentType:'application/javascript',
  body:`window.supabase={createClient(){const user={id:'account-test-user',user_metadata:{}};const session={user};return{channel(){return{on(){return this},subscribe(cb){cb&&cb('SUBSCRIBED');return this},async send(){return'ok'}}},async removeChannel(){},auth:{async getSession(){return{data:{session}}},async signInWithPassword(){return{data:{session},error:null}},async updateUser(){return{error:null}},async signOut(){return{error:null}}},from(){return{select(){return this},eq(){return this},async maybeSingle(){return{data:{updated_at:'2026-08-26T00:00:00Z',payload:{version:1,data:{'calculator-installed-v36':'["account","ninja"]','phone-app-order':'[]','calculator-notes-v36':'[{"id":"n1","title":"Other phone","body":"Restored note","time":1}]','calculator-bible-bookmarks-v44':'["kjv:42:2:15"]'}}},error:null}},async upsert(){return{error:null}}}}}}}`
}));
await page.route('https://*.cwhit.chatgpt.site/**',route=>route.abort());
await page.goto('http://127.0.0.1:4173/calculator-v42.html',{waitUntil:'domcontentloaded',timeout:30000});
for(const digit of ['5','9','6','3'])await page.locator(`#calc [data-v="${digit}"]`).click();
await page.locator('#calc [data-a="eq"]').click();
await page.locator('#home.screen.active').waitFor();
await page.locator('.calculator-account-launch:visible').click();
await page.getByRole('button',{name:'Sign In and Restore'}).click();
await page.getByLabel('Account Name').fill('Clayton');
await page.getByLabel('Account Passcode').fill('calculator-passcode');
await page.getByLabel('Account Passcode').press('Enter');
await page.waitForTimeout(800);
if(!(await page.locator('.account-profile',{hasText:'Calculator Cloud · Sync On'}).count())){
  const state=await page.evaluate(()=>({screen:document.getElementById('app')?.innerText,toast:document.getElementById('toast')?.textContent}));
  throw new Error(`Account sign-in did not finish: ${JSON.stringify(state)} ${errors.join(' | ')}`);
}
const restored=await page.evaluate(()=>({
  installed:JSON.parse(localStorage.getItem('calculator-installed-v36')||'[]'),
  notes:JSON.parse(localStorage.getItem('calculator-notes-v36')||'[]'),
  marks:JSON.parse(localStorage.getItem('calculator-bible-bookmarks-v44')||'[]'),
  snapshot:window.CalculatorAccount.snapshot()
}));
if(!restored.installed.includes('ninja'))throw new Error('Installed creator apps were not restored');
if(restored.notes[0]?.body!=='Restored note')throw new Error('Notes were not restored');
if(!restored.marks.includes('kjv:42:2:15'))throw new Error('Bible saves were not restored');
if('secret-message-history' in restored.snapshot.data||'pics' in restored.snapshot.data||'main-code' in restored.snapshot.data)throw new Error('Device-private data was included in cloud sync');
if(errors.length)throw new Error(errors.join(' | '));
console.log('CALCULATOR_ACCOUNT_RESTORE_PASS');
await context.close();
await browser.close();
