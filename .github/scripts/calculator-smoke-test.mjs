import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

await page.goto('http://127.0.0.1:4173/calculator/', { waitUntil: 'load', timeout: 60000 });

for (const d of ['5','9','6','3']) {
  await page.locator(`#calc [data-v="${d}"]`).click();
}

const before = await page.locator('#disp').textContent();
if (before?.trim() !== '5963') throw new Error(`Display before unlock was ${before}`);

await page.locator('#calc [data-a="eq"]').click();
await page.waitForTimeout(500);

const unlockState = await page.evaluate(() => ({
  calcActive: document.getElementById('calc')?.classList.contains('active'),
  homeActive: document.getElementById('home')?.classList.contains('active'),
  activeId: document.querySelector('.screen.active')?.id || '',
  homeApps: document.querySelectorAll('#home .phone-app').length,
  display: document.getElementById('disp')?.textContent || ''
}));
console.log('UNLOCK_STATE', JSON.stringify(unlockState));

if (!unlockState.homeActive || unlockState.calcActive) {
  throw new Error(`Unlock failed: ${JSON.stringify(unlockState)}`);
}
if (unlockState.homeApps < 4) throw new Error(`Home rendered too few apps: ${unlockState.homeApps}`);

// Verify main thread remains responsive after unlock.
const responsive = await page.evaluate(() => new Promise(resolve => setTimeout(() => resolve(true), 100)));
if (!responsive) throw new Error('Page did not remain responsive after unlock');

// Phone icon should open the Phone app if communication stack loaded.
const phone = page.locator('.calculator-phone-launch').first();
if (await phone.count()) {
  await phone.click();
  await page.waitForTimeout(250);
  const phoneOpen = await page.locator('#app.screen.active .phone-app-page').count();
  console.log('PHONE_OPEN', phoneOpen);
  if (!phoneOpen) throw new Error('Phone icon did not open Phone app');
  await page.locator('#app .ios-back').first().click().catch(() => {});
  await page.waitForTimeout(150);
}

// Contacts icon should open Contacts if present.
const contacts = page.locator('.calculator-contacts-launch').first();
if (await contacts.count()) {
  await contacts.click();
  await page.waitForTimeout(250);
  const contactsTitle = await page.locator('#app.screen.active h2').first().textContent().catch(() => '');
  console.log('CONTACTS_TITLE', contactsTitle);
  if (!String(contactsTitle).includes('Contacts')) throw new Error('Contacts icon did not open Contacts app');
}

if (errors.length) {
  console.log('BROWSER_ERRORS', JSON.stringify(errors));
  throw new Error(`Browser errors detected: ${errors.join(' | ')}`);
}

console.log('CALCULATOR_SMOKE_TEST_PASS');
await browser.close();
