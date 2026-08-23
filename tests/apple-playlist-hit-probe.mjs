import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const executablePath = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((path) => fs.existsSync(path));
if (!executablePath) process.exit(2);

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });

async function inspect(label, target) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/139 Safari/537.36');
  const requests = [];
  const jsonBodies = [];
  page.on('response', async (response) => {
    const url = response.url();
    const headers = response.headers();
    const type = response.request().resourceType();
    if (requests.length < 250 && (/apple/i.test(url) || ['xhr', 'fetch'].includes(type))) {
      requests.push({ status: response.status(), url, type, contentType: headers['content-type'] || '' });
    }
    if ((/json/i.test(headers['content-type'] || '') || ['xhr', 'fetch'].includes(type)) && jsonBodies.length < 40) {
      try {
        const text = await response.text();
        if (/pl\.u-|playlist|relationships|tracks|songs|attributes/i.test(text)) {
          jsonBodies.push({ status: response.status(), url, text: text.slice(0, 50000) });
        }
      } catch {}
    }
  });
  page.on('console', (msg) => { if (/error|warn/.test(msg.type())) console.log(label, 'PAGE', msg.type(), msg.text().slice(0, 300)); });
  const nav = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
  console.log(label, 'NAV', nav?.status(), page.url());
  await new Promise((resolve) => setTimeout(resolve, 20000));
  const body = await page.evaluate(() => document.body?.innerText || '');
  const html = await page.content();
  console.log(label, 'BODY', body.length, body.slice(0, 6000).replace(/\s+/g, ' '));
  console.log(label, 'DURATIONS', (body.match(/\b\d{1,2}:\d{2}\b/g) || []).length);
  console.log(label, 'HTML_PL_ID', (html.match(/pl\.u-JPAZE8mFBD6eAr/g) || []).length, 'HTML_SONG', (html.match(/song\//g) || []).length, 'HTML_TRACKS', (html.match(/tracks/gi) || []).length);
  console.log(label, 'REQUESTS_BEGIN');
  for (const item of requests) console.log(JSON.stringify(item));
  console.log(label, 'REQUESTS_END');
  console.log(label, 'BODIES_BEGIN');
  for (const item of jsonBodies) {
    console.log('BODY_URL', item.status, item.url);
    console.log(item.text.replace(/\s+/g, ' ').slice(0, 50000));
  }
  console.log(label, 'BODIES_END');
  await page.close();
}

await inspect('NORMAL', 'https://music.apple.com/tr/playlist/hit/pl.u-JPAZE8mFBD6eAr');
await inspect('EMBED', 'https://embed.music.apple.com/tr/playlist/hit/pl.u-JPAZE8mFBD6eAr');
await browser.close();
