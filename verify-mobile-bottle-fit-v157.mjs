import fs from 'node:fs';

const css = fs.readFileSync('styles.css', 'utf8');
for (const needle of [
  '.bottle15 { width: 68px !important; height: 102px !important; }',
  '.bottle15-body { width: 60px !important; }',
  'font-size: 7px !important',
  'font-size: 9px !important',
  '.bottle15-version { left: 5px !important; right: 5px !important;'
]) {
  if (!css.includes(needle)) throw new Error(`Missing narrow bottle contract: ${needle}`);
}
console.log('mobile bottle fit contract ok');
