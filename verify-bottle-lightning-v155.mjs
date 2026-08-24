import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');

if (!html.includes('class="bottle15-wordmark"')) throw new Error('Bottle wordmark wrapper missing');
if (!html.includes('ÁMPU<span class="bottle15-letter-bolt" aria-hidden="true">⚡</span>A')) throw new Error('Lightning does not replace L in ÁMPULA');
if (!html.includes('aria-label="ÁMPULA MP"')) throw new Error('Accessible ÁMPULA MP label missing');
if (!html.includes('<span class="bottle15-version">v1.5</span>')) throw new Error('Compact v1.5 label missing');
if (html.includes('VERSION 1.5')) throw new Error('Verbose VERSION 1.5 label still present');

console.log('Bottle lightning wordmark contract OK');
