# CI test runtime cache

## Requirement: shared npm download cache
Every GitHub Actions job that installs the shared Node 22 `jsdom@26` test runtime MUST restore/save the same npm download cache key before installation.

### Scenario: warm cache
Given a cache created by a prior successful run on `develop`, when a later pull-request job installs `jsdom@26`, then npm SHOULD satisfy package downloads from `~/.npm` where possible and tests MUST execute unchanged.

### Scenario: cold cache
Given no matching cache, when a job runs, then npm MUST still install the runtime from the registry and the workflow MUST remain functionally equivalent to the pre-cache workflow.

### Scenario: isolation
The CI cache MUST NOT persist `node_modules`; each job MUST construct its own dependency tree.