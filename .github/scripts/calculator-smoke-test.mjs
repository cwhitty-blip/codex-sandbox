import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const base = 'http://127.0.0.1:4173/calculator/';

async function unlock(page) {
  for (const d of ['5','9','6','3']) await page.locator(`#calc [data-v="${d}"]`).click();
  const before = (await page.locator('#disp').textContent())?.trim();
  if (before !== '5963') throw new Error(`Display before unlock was ${before}`);
  await page.locator('#calc [data-a="eq"]').click();
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => ({
    calcActive: document.getElementById('calc')?.classList.contains('active'),
    homeActive: document.getElementById('home')?.classList.contains('active'),
    activeId: document.querySelector('.screen.active')?.id || '',
    homeApps: document.querySelectorAll('#home .phone-app').length,
    display: document.getElementById('disp')?.textContent || ''
  }));
  console.log('UNLOCK_STATE', JSON.stringify(state));
  if (!state.homeActive || state.calcActive) throw new Error(`Unlock failed: ${JSON.stringify(state)}`);
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
}

async function stubSupabase(page) {
  await page.evaluate(() => {
    class FakeChannel {
      on(){ return this; }
      subscribe(cb){ setTimeout(() => cb?.('SUBSCRIBED'), 0); return this; }
      async httpSend(){ return {status:'ok'}; }
    }
    window.supabase = {
      createClient(){
        return {
          channel(){ return new FakeChannel(); },
          async removeChannel(){ return true; }
        };
      }
    };
  });
}

const cases = [
  ['phone-system.js'],
  ['phone-system.js','message-launcher.js'],
  ['phone-system.js','message-launcher.js','phone-polish.js'],
  ['phone-system.js','message-launcher.js','phone-polish.js','call-ring.js']
];

for (const scripts of cases) {
  const label = scripts.join(' + ');
  console.log(`CASE_START ${label}`);
  const page = await browser.newPage({ viewport: { width:390, height:844 }, isMobile:true, hasTouch:true });
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',msg=>{ if(msg.type()==='error') errors.push(`console: ${msg.text()}`); });

  // Prevent the real communications loader from starting; add each layer deliberately below.
  await page.route('**/communications-loader.js*', route => route.fulfill({ status:200, contentType:'application/javascript', body:'window.__diagnosticCommunications=true;' }));
  await page.goto(base,{waitUntil:'load',timeout:20000});
  await unlock(page);
  await stubSupabase(page);

  for (const src of scripts) await page.addScriptTag({ url: base + src });
  await page.waitForTimeout(150);

  const count = await page.locator('.calculator-phone-launch').count();
  console.log(`PHONE_ICON_COUNT ${label} ${count}`);
  if (!count) throw new Error(`Phone icon missing in case ${label}`);

  let clickError='';
  try {
    await page.locator('.calculator-phone-launch').first().click({timeout:3000});
  } catch (e) {
    clickError=String(e);
  }
  if (clickError) {
    console.log(`CASE_FAIL_CLICK ${label} ${clickError}`);
    await page.close();
    continue;
  }

  await page.waitForTimeout(100);
  const phoneState = await page.evaluate(() => ({
    active: document.querySelector('.screen.active')?.id || '',
    phonePage: !!document.querySelector('#app .phone-app-page'),
    bodyText: document.getElementById('app')?.textContent?.slice(0,120) || ''
  }));
  console.log(`CASE_PHONE_STATE ${label} ${JSON.stringify(phoneState)}`);
  if (!phoneState.phonePage || phoneState.active!=='app') {
    console.log(`CASE_FAIL_OPEN ${label}`);
  } else {
    console.log(`CASE_PASS ${label}`);
  }
  if(errors.length) console.log(`CASE_BROWSER_ERRORS ${label} ${JSON.stringify(errors)}`);
  await page.close();
}

await browser.close();
console.log('COMMUNICATION_ISOLATION_DONE');
