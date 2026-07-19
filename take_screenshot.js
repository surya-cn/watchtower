const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });

  // Navigate to local dashboard with project test-1 (wait until network is mostly idle)
  console.log('Navigating to dashboard...');
  await page.goto('http://localhost:3000/?project=test-1', { waitUntil: 'networkidle2' });

  // Wait for the View button to appear in the table
  console.log('Waiting for View button...');
  await page.waitForSelector('button', { timeout: 30000 });
  
  // Find a button that says "View"
  const buttons = await page.$$('button');
  let viewBtn = null;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text === 'View') {
      viewBtn = btn;
      break;
    }
  }

  if (viewBtn) {
    console.log('Clicking View button...');
    await viewBtn.click();
    
    // Wait for the Issue Details panel to animate in
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take a screenshot of the page showing the modal
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'C:\\Users\\surya\\.gemini\\antigravity\\brain\\4acf14a2-8131-4fd3-a8dc-b07547904631\\screenshot.png' });
    console.log('Screenshot saved.');
  } else {
    console.log('Could not find View button. Saving fallback screenshot...');
    await page.screenshot({ path: 'C:\\Users\\surya\\.gemini\\antigravity\\brain\\4acf14a2-8131-4fd3-a8dc-b07547904631\\screenshot_fallback.png' });
  }

  await browser.close();
  process.exit(0);
})();
