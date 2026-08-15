import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width:390, height:844 }, isMobile:true, hasTouch:true });
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',msg=>{ if(msg.type()==='error') errors.push(`console: ${msg.text()}`); });

// Use the real Calculator v26 communications loader, but replace the remote realtime service
// with a deterministic in-browser stand-in so the UI test does not depend on the network.
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*', route => route.fulfill({
  status:200,
  contentType:'application/javascript',
  body:`(()=>{class FakeChannel{on(){return this}subscribe(cb){setTimeout(()=>cb&&cb('SUBSCRIBED'),0);return this}async httpSend(){return {status:'ok'}}}window.supabase={createClient(){return {channel(){return new FakeChannel()},async removeChannel(){return true}}}}})();`
}));

await page.goto('http://127.0.0.1:4173/calculator/',{waitUntil:'load',timeout:20000});

// Reproduce the user's exact unlock flow.
for(const d of ['5','9','6','3']) await page.locator(`#calc [data-v="${d}"]`).click();
const before=(await page.locator('#disp').textContent())?.trim();
if(before!=='5963') throw new Error(`Display before unlock was ${before}`);
await page.locator('#calc [data-a="eq"]').click();
await page.waitForTimeout(250);

const unlockState=await page.evaluate(()=>({
  calcActive:document.getElementById('calc')?.classList.contains('active'),
  homeActive:document.getElementById('home')?.classList.contains('active'),
  activeId:document.querySelector('.screen.active')?.id||'',
  homeApps:document.querySelectorAll('#home .phone-app').length,
  display:document.getElementById('disp')?.textContent||''
}));
console.log('UNLOCK_STATE',JSON.stringify(unlockState));
if(!unlockState.homeActive||unlockState.calcActive) throw new Error(`Unlock failed: ${JSON.stringify(unlockState)}`);
if(unlockState.homeApps<8) throw new Error(`Too few Home Screen apps: ${unlockState.homeApps}`);

// Wait for delayed communications stack to load, then verify its main apps are usable.
await page.locator('.calculator-phone-launch').first().waitFor({state:'visible',timeout:6000});
await page.locator('.calculator-phone-launch').first().click({timeout:3000});
await page.waitForTimeout(100);
if(!(await page.locator('#app.screen.active .phone-app-page').count())) throw new Error('Phone did not open');
console.log('PHONE_PASS');

await page.locator('#app .ios-back').first().click({timeout:3000});
await page.waitForTimeout(100);
if(!(await page.locator('#home.screen.active').count())) throw new Error('Phone did not return Home');

await page.locator('.calculator-contacts-launch').first().click({timeout:3000});
await page.waitForTimeout(100);
const contactsTitle=(await page.locator('#app.screen.active h2').first().textContent())||'';
if(!contactsTitle.includes('Contacts')) throw new Error(`Contacts did not open: ${contactsTitle}`);
console.log('CONTACTS_PASS');

await page.locator('#app .ios-back').first().click({timeout:3000});
await page.waitForTimeout(100);

await page.locator('.secret-message-launch').first().click({timeout:3000});
await page.waitForTimeout(100);
const messageTitle=(await page.locator('#app.screen.active h2').first().textContent())||'';
if(!messageTitle.includes('Secret Message')) throw new Error(`Messages did not open: ${messageTitle}`);
console.log('MESSAGES_PASS');

// Make sure the UI remains responsive after the complete sequence.
const responsive=await page.evaluate(()=>new Promise(resolve=>setTimeout(()=>resolve(true),100)));
if(!responsive) throw new Error('UI stopped responding');

if(errors.length){
  console.log('BROWSER_ERRORS',JSON.stringify(errors));
  throw new Error(errors.join(' | '));
}

console.log('CALCULATOR_V26_SMOKE_TEST_PASS');
await browser.close();
