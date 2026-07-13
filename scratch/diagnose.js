import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 851, isMobile: true, hasTouch: true });

  const logs = [];

  page.on('console', async (msg) => {
    const text = msg.text();
    if (text.includes('[3b-debug]')) {
      try {
        const args = msg.args();
        if (args.length >= 2) {
          const val = await args[1].jsonValue();
          console.log('[3b-debug-real]', JSON.stringify(val));
          logs.push(val);
        }
      } catch (err) {
        console.error('Failed to parse console arg:', err);
      }
    }
  });

  console.log('Navigating to http://localhost:8080/...');
  try {
    await page.goto('http://localhost:8080/', { waitUntil: 'networkidle2', timeout: 20000 });
  } catch (err) {
    console.error('Failed to navigate:', err);
  }

  console.log('Waiting for initial load (4s)...');
  await new Promise(r => setTimeout(r, 4000));

  // Scroll the feed container card by card
  console.log('Scrolling down feed container...');
  for (let i = 0; i < 6; i++) {
    console.log(`Scrolling card ${i}...`);
    await page.evaluate((index) => {
      const container = document.querySelector('[data-tutorial="feed"]');
      if (container) {
        container.scrollTo({ top: (index + 1) * container.clientHeight, behavior: 'smooth' });
      }
    }, i);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('Saving collected [3b-debug] logs to scratch/collected_logs.json...');
  fs.writeFileSync('scratch/collected_logs.json', JSON.stringify(logs, null, 2));

  await browser.close();
  console.log('Done.');
})();
