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
const bodies = [];
page.on('response', async (response) => {
  const url = response.url();
  if (!/music\.apple\.com|apple\.com|amp-api|api\.music/i.test(url)) return;
  const headers = response.headers();
  if (interesting.length < 180) {
    interesting.push({
      status: response.status(),
      url,
      type: response.request().resourceType(),
      contentType: headers['content-type'] || '',
    });
  }
  if (/json/i.test(headers['content-type'] || '') && bodies.length < 25) {
    try {
      const text = await response.text();
      if (/playlist|track|song|pl\.u-/i.test(text)) {
        bodies.push({ url, status: response.status(), text: text.slice(0, 30000) });
      }
    } catch {}
  }
});
page.on('console', (msg) => console.log('PAGE', msg.type(), msg.text().slice(0, 500)));

const target = 'https://music.apple.com/tr/playlist/hit/pl.u-JPAZE8mFBD6eAr';
const nav = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
console.log('NAV', nav?.status(), page.url());
await new Promise((resolve) => setTimeout(resolve, 18000));
console.log('TITLE', await page.title());
const bodyText = await page.evaluate(() => document.body?.innerText || '');
console.log('BODY_LENGTH', bodyText.length);
console.log('BODY_HEAD', bodyText.slice(0, 16000).replace(/\s+/g, ' '));
console.log('BODY_DURATION_COUNT', (bodyText.match(/\b\d{1,2}:\d{2}\b/g) || []).length);

console.log('NETWORK_BEGIN');
for (const item of interesting) console.log(JSON.stringify(item));
console.log('NETWORK_END');
console.log('JSON_BODIES_BEGIN');
for (const body of bodies) {
  console.log('JSON_URL', body.status, body.url);
  console.log(body.text.replace(/\s+/g, ' ').slice(0, 30000));
}
console.log('JSON_BODIES_END');
await browser.close();
