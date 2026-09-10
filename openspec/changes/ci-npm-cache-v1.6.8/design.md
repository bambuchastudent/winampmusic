# Design: CI npm cache v1.6.8

Use `actions/cache@v4` to cache `~/.npm` with one shared key for the current test runtime:

`$RUNNER_OS-node22-npm-jsdom26`

The existing installation remains an explicit `npm install --no-save jsdom@26`, augmented with `--prefer-offline --no-audit --no-fund`. This deliberately caches package tarballs/metadata rather than `node_modules`, so each job still builds its own dependency tree and keeps workflow isolation.

The same cache key is used by every workflow that installs the same Node 22/jsdom 26 runtime. Caches warmed on `develop` can then be reused by subsequent pull-request runs.