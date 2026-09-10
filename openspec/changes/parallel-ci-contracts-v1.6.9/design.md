# Design: parallel CI contracts v1.6.9

A new `scripts/run-node-tests.mjs` launches test files with `process.execPath` and a bounded worker pool. Each test remains a separate Node process, preserving the isolation of the existing CI. Output is buffered per test and emitted in a GitHub Actions log group so concurrent processes do not make logs unreadable.

Default concurrency is 4. Callers may pass repeated `--exclude <file>` arguments. A non-zero child exit makes the runner fail after all scheduled tests finish, so one failure does not hide other regressions.

Release gate:
- run the existing functional test files through four workers;
- run mutation and performance gates separately and sequentially.

Pages verification:
- run all ordinary `tests/*.mjs` and `verify-*.mjs` contracts through four workers;
- exclude mutation and performance from the parallel batch;
- run mutation and performance afterward, separately.

Specialized workflow scheduling:
- preserve existing workflow and job names;
- add narrow path filters only to workflows that currently run on every pull request despite testing a specific subsystem.

No `node_modules` cache and no new npm package are introduced.