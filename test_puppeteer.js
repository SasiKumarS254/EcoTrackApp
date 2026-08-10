const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto('http://localhost:3000/#profile', {waitUntil: 'networkidle0'});
  
  // Inject a token into localStorage so it logs in
  await page.evaluate(() => {
    localStorage.setItem('@ecotrack_web_session', JSON.stringify({
      id: 'usr1',
      email: 'eco@example.com',
      name: 'Eco Explorer',
      token: 'ecotrack_dXNyMTplY29AZXhhbXBsZS5jb20='
    }));
  });
  
  // Reload to apply token
  await page.reload({waitUntil: 'networkidle0'});
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
