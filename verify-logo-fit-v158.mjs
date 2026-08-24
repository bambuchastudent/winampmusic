import fs from 'node:fs';
const html = fs.readFileSync('index.html','utf8');
if (!html.includes('ÁMPU<span class="bolt-l">⚡</span>A')) throw new Error('Bottle wordmark must render full ÁMPU⚡A');
if (!html.includes('.bottle15-name{display:block;width:100%')) throw new Error('Bottle wordmark must use full label width');
console.log('bottle logo fit contract ok');
