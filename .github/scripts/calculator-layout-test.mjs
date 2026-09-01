import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.addInitScript(()=>{
  localStorage.setItem('main-code','5963');
  localStorage.setItem('calculator-installed-v36',JSON.stringify(['checklist']));
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient(){return{channel(){return{on(){return this},subscribe(){return this}}},removeChannel(){}}}}'}));
await page.goto('http://127.0.0.1:4173/calculator-v42.html',{waitUntil:'load',timeout:20000});
for(const digit of ['5','9','6','3'])await page.locator(`#calc [data-v="${digit}"]`).click();
await page.locator('#calc [data-a="eq"]').click();
await page.locator('#home.screen.active').waitFor();
await page.locator('.pro-installed-app[data-pro-id="checklist"]').waitFor();

const phone=page.locator('.phone-app').filter({hasText:'Phone'}).first();
const box=await phone.boundingBox();
if(!box)throw new Error('Phone icon has no layout box');
await phone.dispatchEvent('pointerdown',{pointerId:7,clientX:box.x+box.width/2,clientY:box.y+box.height/2});
await page.waitForTimeout(540);
await phone.dispatchEvent('pointerup',{pointerId:7,clientX:box.x+box.width/2,clientY:box.y+box.height/2});
if(!(await page.locator('#home.home-editing').count()))throw new Error('Long press did not enter edit mode');
if(!(await page.locator('.home-edit-done:visible').count()))throw new Error('Done control is missing');
if(await phone.locator('.app-remove-control').count())throw new Error('Built-in Phone app became removable');
if(!(await page.getByRole('button',{name:'Remove Checklist',exact:true}).count()))throw new Error('Downloaded Checklist lacks a Remove control');

const photos=page.locator('.phone-app').filter({hasText:'Photos'}).first();
const photosBox=await photos.boundingBox();
if(!photosBox)throw new Error('Photos icon has no layout box');
await photos.dispatchEvent('pointerdown',{pointerId:10,clientX:photosBox.x+photosBox.width/2,clientY:photosBox.y+photosBox.height/2});
await photos.dispatchEvent('pointermove',{pointerId:10,clientX:box.x+box.width/2,clientY:box.y+box.height/2});
await photos.dispatchEvent('pointerup',{pointerId:10,clientX:box.x+box.width/2,clientY:box.y+box.height/2});
const firstAfterDrag=(await page.locator('.phone-page').first().locator('.phone-grid>.phone-app:visible .phone-label').first().textContent())?.trim();
if(firstAfterDrag!=='Photos')throw new Error('Drag did not move Photos before Phone');
await page.locator('.home-edit-done').click();
if(await page.locator('#home.home-editing').count())throw new Error('Done did not exit edit mode');

await page.reload({waitUntil:'load'});
for(const digit of ['5','9','6','3'])await page.locator(`#calc [data-v="${digit}"]`).click();
await page.locator('#calc [data-a="eq"]').click();
await page.locator('#home.screen.active').waitFor();
const firstAfterReload=(await page.locator('.phone-page').first().locator('.phone-grid>.phone-app:visible .phone-label').first().textContent())?.trim();
if(firstAfterReload!=='Photos')throw new Error('Home Screen order did not persist after reload');

const phoneAfterReload=page.locator('.phone-app').filter({hasText:'Phone'}).first();
const reloadBox=await phoneAfterReload.boundingBox();
if(!reloadBox)throw new Error('Phone icon has no layout box after reload');
await phoneAfterReload.dispatchEvent('pointerdown',{pointerId:8,clientX:reloadBox.x+reloadBox.width/2,clientY:reloadBox.y+reloadBox.height/2});
await page.waitForTimeout(540);
await phoneAfterReload.dispatchEvent('pointerup',{pointerId:8,clientX:reloadBox.x+reloadBox.width/2,clientY:reloadBox.y+reloadBox.height/2});
await page.locator('#home .phone-status').click({position:{x:180,y:10}});
if(await page.locator('#home.home-editing').count())throw new Error('Tapping outside did not exit edit mode');

await phoneAfterReload.dispatchEvent('pointerdown',{pointerId:9,clientX:reloadBox.x+reloadBox.width/2,clientY:reloadBox.y+reloadBox.height/2});
await page.waitForTimeout(540);
await phoneAfterReload.dispatchEvent('pointerup',{pointerId:9,clientX:reloadBox.x+reloadBox.width/2,clientY:reloadBox.y+reloadBox.height/2});
await page.getByRole('button',{name:'Remove Checklist',exact:true}).click({force:true});
if(await page.locator('.pro-installed-app[data-pro-id="checklist"]').count())throw new Error('Downloaded app remained after removal');
const installed=await page.evaluate(()=>JSON.parse(localStorage.getItem('calculator-installed-v36')||'[]'));
if(installed.includes('checklist'))throw new Error('Removal did not persist');

if(errors.length)throw new Error(errors.join(' | '));
console.log('CALCULATOR_HOME_LAYOUT_PASS');
await context.close();
await browser.close();
