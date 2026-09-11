# Production release lifecycle

ÁmpulaMP production is published from `develop` by the Pages workflow.

A successful Pages deployment chooses one Madrid-time revision in the form `rYYMMDDHHMM`. The same revision is used in three places:

1. the visible footer (`v1.5 rYYMMDDHHMM`);
2. a Git tag named `rYYMMDDHHMM` targeting the deployed commit;
3. a GitHub Release named `ÁmpulaMP rYYMMDDHHMM`.

The Release page contains a **Published** section. For a normal PR merge it includes the merged PR title, link and PR body, followed by deployment metadata (revision, commit SHA and the Pages URL). A non-PR push falls back to the deployed commit message.

Tag and Release creation runs only after the Pages deployment succeeds. A failed verification/deployment is therefore never marked as a production release.

Merged same-repository feature branches are deleted automatically by the `Delete merged feature branch` workflow. Closed-but-unmerged PRs, fork branches and trunk names (`develop`, `main`, `master`) are not deleted.
