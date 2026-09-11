import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

export function classifyReleaseType(headRefName) {
  const branch = clean(headRefName).toLowerCase();
  if (/^(feature|feat)\//.test(branch)) return 'Feature';
  if (/^(fix|bugfix|hotfix)\//.test(branch)) return 'Bugfix';
  return 'Maintenance';
}

export function shortSummary(body, fallbackTitle) {
  const lines = String(body ?? '').split(/\r?\n/);
  const bullet = lines.find((line) => /^\s*[-*]\s+\S/.test(line));
  if (bullet) return clean(bullet.replace(/^\s*[-*]\s+/, ''));
  return clean(fallbackTitle) || 'No summary supplied.';
}

export function renderReleaseNotes({ pr, revision, sha, pagesUrl }) {
  const releaseType = classifyReleaseType(pr?.headRefName);
  const title = clean(pr?.title) || 'Production update';
  const summary = shortSummary(pr?.body, title);
  const body = String(pr?.body ?? '').trim() || '_No PR description supplied._';
  const number = Number(pr?.number);
  const url = clean(pr?.url);
  const published = Number.isInteger(number) && number > 0 && url
    ? `### [#${number} — ${title}](${url})`
    : `### ${title}`;

  return [
    `## ${releaseType}`,
    '',
    summary,
    '',
    '## Published',
    '',
    published,
    '',
    body,
    '',
    '## Deployment',
    '',
    `- Revision: \`${clean(revision)}\``,
    `- Commit: \`${clean(sha)}\``,
    `- Pages: ${clean(pagesUrl)}`,
    '',
  ].join('\n');
}

function main() {
  const [, , inputPath = 'release-pr.json', outputPath = 'release-notes.md'] = process.argv;
  const pr = JSON.parse(readFileSync(inputPath, 'utf8'));
  const revision = clean(process.env.REVISION);
  const sha = clean(process.env.GITHUB_SHA);
  const pagesUrl = clean(process.env.PAGES_URL);
  if (!revision || !sha || !pagesUrl) {
    throw new Error('REVISION, GITHUB_SHA and PAGES_URL are required');
  }
  writeFileSync(outputPath, renderReleaseNotes({ pr, revision, sha, pagesUrl }), 'utf8');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
