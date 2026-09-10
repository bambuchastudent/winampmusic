import fs from 'node:fs';

const [, , file = 'index.html', revision = ''] = process.argv;

if (!/^\d{10}$/.test(revision)) {
  console.error('Build revision must be exactly 10 digits in YYMMDDHHMM format');
  process.exit(2);
}

const source = fs.readFileSync(file, 'utf8');
const footerLink = /(<a\b[^>]*class="app-version-link"[^>]*>)([^<]*)(<\/a>)/;
const match = source.match(footerLink);

if (!match) {
  console.error('Could not find .app-version-link footer anchor');
  process.exit(3);
}

const text = `v1.5 r${revision}`;
const stamped = source.replace(footerLink, `$1${text}$3`);

if (stamped === source) {
  console.error('Footer revision stamp did not change the document');
  process.exit(4);
}

fs.writeFileSync(file, stamped);
console.log(`Stamped ${file}: ${text}`);
