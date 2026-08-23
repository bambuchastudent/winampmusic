import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const candidates = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
const executablePath = candidates.find((path) => fs.existsSync(path));
console.log('CHROME', executablePath || 'none');
if (!executablePath) process.exit(2);

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/139 Safari/537.36');
const interesting = [];
page.on('response', async (response) => {
  const url = response.url();
  if (/music\.apple\.com|apple\.com|amp-api|api\.music/i.test(url)) {
    if (interesting.length < 120) {
      const headers = response.headers();
      interesting.push({ status: response.status(), url, type: response.request().resourceType(), contentType: headers['content-type'] || '' });
    }
  }
});
page.on('console', (msg) => console.log('PAGE', msg.type(), msg.text().slice(0, 500)));
const target = 'https://music.apple.com/tr/playlist/hit/pl.u-JPAZE8mFBD6eAr';
const nav = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
console.log('NAV', nav?.status(), page.url());
await new Promise((resolve) => setTimeout(resolve, 15000));
console.log('TITLE', await page.title());
console.log('BODY_HEAD', (await page.locator('body').innerText()).slice(0, 12000).replace(/\s+/g, ' '));
console.log('NETWORK_BEGIN');
for (const item of interesting) console.log(JSON.stringify(item));
console.log('NETWORK_END');
await browser.close();
