const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

  console.log('Navigating to login...');
  await page.goto('http://localhost:3000/login');
  
  console.log('Waiting for form...');
  await page.waitForSelector('input[name="username"]');
  
  const formHtml = await page.$eval('form', el => el.outerHTML);
  console.log('Form HTML:', formHtml);
  
  console.log('Typing credentials...');
  await page.type('input[name="username"]', 'admin');
  await page.type('input[name="password"]', 'admin');
  
  console.log('Clicking sign in...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(e => console.log('Nav:', e.message)),
    page.click('button[type="submit"]')
  ]);
  
  console.log('Final URL:', page.url());
  
  await browser.close();
})();
