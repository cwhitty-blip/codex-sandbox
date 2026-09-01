import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.addInitScript(()=>{
  localStorage.setItem('main-code','5963');
  localStorage.setItem('calculator-installed-v36','[]');
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient(){return{channel(){return{on(){return this},subscribe(){return this}}},removeChannel(){}}}}'}));
await page.route('https://*.cwhit.chatgpt.site/**',route=>route.abort());
await page.goto('http://127.0.0.1:4173/calculator-v42.html',{waitUntil:'load',timeout:20000});
for(const digit of ['5','9','6','3'])await page.locator(`#calc [data-v="${digit}"]`).click();
await page.locator('#calc [data-a="eq"]').click();
await page.locator('#home.screen.active').waitFor();

const bible=page.locator('.phone-app').filter({hasText:'Bible'}).first();
await bible.waitFor();
if(await bible.evaluate(el=>el.classList.contains('optional-installed-app')||el.classList.contains('pro-installed-app')))throw new Error('Bible is removable instead of permanent');
await bible.click();
await page.locator('.bible-chapter h1',{hasText:'John 3'}).waitFor();
if(!(await page.locator('.bible-verse[data-verse="16"]').textContent())?.includes('God so loved the world'))throw new Error('KJV John 3:16 is missing');
await page.getByRole('button',{name:'Read chapter aloud'}).click();
await page.locator('.bible-player:visible').waitFor();
if(!(await page.locator('.bible-verse.speaking').count()))throw new Error('Read aloud did not mark the current verse');
await page.getByRole('button',{name:'Pause read aloud'}).click();
await page.getByRole('button',{name:'Stop read aloud'}).click();
if(await page.locator('.bible-player:visible').count())throw new Error('Read aloud did not stop');

await page.locator('.bible-version').selectOption('asv');
await page.locator('.bible-chapter h1',{hasText:'John 1'}).waitFor();
if(await page.locator('.bible-version').inputValue()!=='asv')throw new Error('ASV did not load');
await page.locator('.bible-tab-search').click();
await page.getByLabel('Search the Bible').fill('John 3:16');
await page.locator('.bible-search button').click();
await page.locator('.bible-result',{hasText:'John 3:16 ASV'}).click();
await page.locator('.bible-verse[data-verse="16"]').click();
await page.locator('.bible-actions button',{hasText:'Save'}).click();
await page.locator('.bible-tab-saved').click();
await page.locator('.bible-result',{hasText:'John 3:16 ASV'}).waitFor();

await page.locator('.bible-home').click();
if(await page.locator('.phone-app:visible').filter({hasText:'Ninja'}).count())throw new Error('Creator apps are preinstalled on a fresh Home Screen');
await page.locator('.phone-app').filter({hasText:'App Store'}).first().click();
const ninjaRow=page.locator('.store-row').filter({has:page.locator('.store-meta strong',{hasText:/^Ninja$/})});
await ninjaRow.locator('.store-get').click();
await page.locator('.pro-back').click();
const ninja=page.locator('.pro-generated-app[data-pro-id="ninja"]');
await ninja.waitFor();
await ninja.click();
const frame=page.locator('.project-web-frame');
await frame.waitFor();
if(!(await frame.getAttribute('src'))?.includes('ninja-y-game'))throw new Error('Creator app is not opening inside Calculator');

if(errors.length)throw new Error(errors.join(' | '));
console.log('CALCULATOR_BIBLE_PASS');
await context.close();
await browser.close();
