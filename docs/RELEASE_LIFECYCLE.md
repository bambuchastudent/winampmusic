# Production release lifecycle

ÁmpulaMP production is published from `develop` by the Pages workflow.

A successful Pages deployment chooses one Madrid-time revision in the form `rYYMMDDHHMM`. The same revision is used in three places:

1. the visible footer (`v1.5 rYYMMDDHHMM`);
2. a Git tag named `rYYMMDDHHMM` targeting the deployed commit;
3. a GitHub Release named `ÁmpulaMP rYYMMDDHHMM`.

For a normal PR merge, the Release page starts with a compact typed summary:

- `feature/` or `feat/` → **Feature**;
- `fix/`, `bugfix/` or `hotfix/` → **Bugfix**;
- every other branch → **Maintenance**.

That heading is followed by a one-line summary taken from the first Markdown bullet in the PR body, falling back to the PR title when no bullet exists. The goal is to make the first screen answer “what kind of release is this?” and “what changed?” without losing traceability.

The detailed **Published** section follows the short summary and keeps the merged PR title, link and full PR body. The final **Deployment** section keeps the revision, commit SHA and Pages URL. A non-PR push falls back to the deployed commit title/body and is classified as Maintenance.

Tag and Release creation runs only after the Pages deployment succeeds. A failed verification/deployment is therefore never marked as a production release.

Merged same-repository feature branches are deleted automatically by the `Delete merged feature branch` workflow. Closed-but-unmerged PRs, fork branches and trunk names (`develop`, `main`, `master`) are not deleted.
