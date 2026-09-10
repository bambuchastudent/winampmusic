# Proposal: shared npm cache for CI test runtime

## Problem
Several GitHub Actions workflows independently install the same `jsdom@26` runtime. The package download work is repeated across workflows and across commits even though the dependency is identical.

## Change
Cache the npm download directory with a shared Node 22/jsdom 26 cache key in every workflow that installs `jsdom@26`, and prefer cached packages during installation.

## Non-goals
- Do not cache `node_modules`.
- Do not change test selection or behavior.
- Do not merge independent workflow gates in this change.

## Expected result
After the cache is warm on `develop`, subsequent PR runs avoid most package downloads while retaining the existing test commands and isolation.