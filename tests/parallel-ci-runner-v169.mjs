import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const runner = path.join(root, 'scripts/run-node-tests.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ampula-ci-runner-'));

try {
  const passA = path.join(temp, 'pass-a.mjs');
  const passB = path.join(temp, 'pass-b.mjs');
  const failA = path.join(temp, 'fail-a.mjs');
  const failB = path.join(temp, 'fail-b.mjs');

  fs.writeFileSync(passA, "console.log('PASS-A');\n");
  fs.writeFileSync(passB, "console.log('PASS-B');\n");
  fs.writeFileSync(failA, "console.error('FAIL-A'); process.exit(3);\n");
  fs.writeFileSync(failB, "console.error('FAIL-B'); process.exit(4);\n");

  const success = execFileSync(process.execPath, [runner, '--jobs', '2', passA, passB], { encoding: 'utf8' });
  assert.match(success, /2\/2 passed with 2 workers/);
  assert.match(success, /PASS-A/);
  assert.match(success, /PASS-B/);

  const failed = spawnSync(process.execPath, [runner, '--jobs', '2', passA, failA, failB], { encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /1\/3 passed with 2 workers/);
  assert.match(failed.stderr, /FAIL-A/);
  assert.match(failed.stderr, /FAIL-B/);

  const excluded = execFileSync(process.execPath, [runner, '--jobs', '2', '--exclude', failA, passA, failA], { encoding: 'utf8' });
  assert.match(excluded, /1\/1 passed with 1 workers/);
  assert.doesNotMatch(excluded, /FAIL-A/);

  const invalid = spawnSync(process.execPath, [runner, '--jobs', '0', passA], { encoding: 'utf8' });
  assert.equal(invalid.status, 2);

  console.log('parallel CI runner contract: ok');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
