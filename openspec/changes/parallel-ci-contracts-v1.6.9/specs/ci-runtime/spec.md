# CI parallel contract execution

## Requirement: bounded parallelism
Independent Node contract files MUST be runnable with a configurable bounded concurrency and MUST remain separate Node processes.

### Scenario: successful batch
Given multiple independent contract files and a worker limit of four, when the batch runs, then no more than four child test processes may execute concurrently and the runner MUST exit zero only if every child exits zero.

### Scenario: multiple failures
Given more than one failing contract, when the parallel batch runs, then the runner MUST continue collecting scheduled results, print each failing file's output, and exit non-zero.

### Scenario: isolated timing gates
Mutation and performance contracts MUST NOT execute in the parallel functional batch used by the release gate or Pages verification.

### Scenario: readable output
Each child contract's stdout/stderr MUST be emitted as one grouped result so concurrent execution does not interleave individual test logs beyond recognition.

## Requirement: preserve check identity
CI optimization MUST NOT rename existing release, integrity, resolver, diagnostics, origin/playback, equalizer, footer, or unified-entry workflow identities.