import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2);
let jobs = 4;
const excludes = new Set();
const files = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--jobs') {
    const value = Number(args[++i]);
    if (!Number.isInteger(value) || value < 1) {
      console.error('run-node-tests: --jobs must be a positive integer');
      process.exit(2);
    }
    jobs = value;
    continue;
  }
  if (arg === '--exclude') {
    const value = args[++i];
    if (!value) {
      console.error('run-node-tests: --exclude requires a file path');
      process.exit(2);
    }
    excludes.add(value);
    continue;
  }
  files.push(arg);
}

const selected = [...new Set(files)].filter((file) => !excludes.has(file));
if (selected.length === 0) {
  console.error('run-node-tests: no test files selected');
  process.exit(2);
}

function runFile(file) {
  return new Promise((resolve) => {
    const started = performance.now();
    const child = spawn(process.execPath, [file], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    child.on('error', (error) => {
      resolve({ file, code: 1, stdout, stderr: `${stderr}${error.stack || error.message}\n`, ms: performance.now() - started });
    });
    child.on('close', (code, signal) => {
      resolve({
        file,
        code: code ?? 1,
        stdout,
        stderr: signal ? `${stderr}terminated by ${signal}\n` : stderr,
        ms: performance.now() - started,
      });
    });
  });
}

let cursor = 0;
const results = new Array(selected.length);

async function worker() {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= selected.length) return;
    results[index] = await runFile(selected[index]);
  }
}

const started = performance.now();
await Promise.all(Array.from({ length: Math.min(jobs, selected.length) }, () => worker()));

let failures = 0;
for (const result of results) {
  if (result.code !== 0) failures += 1;
  console.log(`::group::${result.file} · ${result.code === 0 ? 'PASS' : `FAIL ${result.code}`} · ${Math.round(result.ms)}ms`);
  if (result.stdout) process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`);
  if (result.stderr) process.stderr.write(result.stderr.endsWith('\n') ? result.stderr : `${result.stderr}\n`);
  console.log('::endgroup::');
}

const elapsed = Math.round(performance.now() - started);
console.log(`run-node-tests: ${selected.length - failures}/${selected.length} passed with ${Math.min(jobs, selected.length)} workers in ${elapsed}ms`);
process.exitCode = failures === 0 ? 0 : 1;
