# Proposal: parallel CI contracts v1.6.9

## Problem
CI now restores the shared npm cache quickly, but most remaining test time is spent starting many independent Node test processes sequentially. Pages verification is especially wasteful because it executes every `tests/*.mjs` one after another.

## Change
Add a dependency-free Node test runner that executes independent contract files with bounded parallelism. Use four workers for functional/contract tests while keeping mutation and performance gates isolated and sequential. Also narrow always-on specialized workflow triggers where the workflow contract only applies to a known subsystem.

## Non-goals
- Do not remove behavioral coverage.
- Do not run mutation or performance tests concurrently with other tests.
- Do not rename the existing required workflow/check identities.
- Do not introduce Docker images or additional npm dependencies.

## Expected result
The same behavioral contracts run with less wall-clock time and less unnecessary workflow scheduling, while failures remain attributable to their individual test files.