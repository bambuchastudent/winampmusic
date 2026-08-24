import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');

const required = [
  '<span class="bottle15-name">ÁMPULA<br>MP</span>',
  '<span class="bottle15-version">VERSION 1.5</span>',
  '.bottle15-version{position:absolute;',
  'bottom:4px',
  'border-top:1px solid rgba(255,255,255,.38)',
];

for (const needle of required) {
  if (!html.includes(needle)) throw new Error(`Missing bottle label contract: ${needle}`);
}

const labelIndex = html.indexOf('bottle15-name');
const versionIndex = html.indexOf('bottle15-version', labelIndex);
if (labelIndex < 0 || versionIndex < labelIndex) {
  throw new Error('Version must be rendered after the ÁMPULA MP name on the label');
}

console.log('Bottle label contract OK');
