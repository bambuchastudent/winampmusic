# Design — compact release summaries v1.7.7

The Pages `release` job already resolves the merged PR for the deployed SHA. Extend that lookup to include `headRefName`, then derive a deterministic release type from the branch prefix.

The short summary is the first Markdown bullet in the PR body. If the body contains no bullet, fall back to the PR title. CI does not call an LLM and does not rewrite the detailed PR body.

Generated order:

1. `## Feature`, `## Bugfix`, or `## Maintenance`;
2. one-line summary;
3. `## Published` with PR link and full PR body;
4. `## Deployment` with revision, SHA and Pages URL.

This keeps the release page scannable while retaining complete traceability.
