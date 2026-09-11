# Design — release lifecycle v1.7.6

## Pages-owned revision

The existing Pages deploy job remains the only place that chooses the production revision. Its stamp step emits the exact `rYYMMDDHHMM` value as a job output while passing the numeric portion to the existing footer stamper. This guarantees the visible footer and release tag cannot diverge within one workflow run.

## Post-deploy release job

A `release` job depends on successful `deploy` and has `contents: write`. It runs only for `push` deployments from `develop`, uses the revision output, and creates a GitHub Release targeted at the deployed `GITHUB_SHA`. `gh release create` creates the matching Git tag.

Release notes prefer the PR associated with the deployed merge commit via GitHub's commit→pulls API. The PR title, URL and body are copied into a `Published` section. If no PR is associated, the deployed commit message is used. Revision, SHA and Pages URL are always appended.

The job is idempotent for a revision that already has a release. A revision collision with an existing unrelated tag is treated as an error rather than silently publishing mismatched metadata.

## Branch cleanup

A separate workflow listens to `pull_request.closed`. It runs only when `merged == true` and the head repository is the same repository. With `contents: write`, it removes the merged head ref through the GitHub API. Default/trunk branch names are guarded explicitly.

## Security and failure modes

- Fork PR branches are never deleted.
- Closed but unmerged PRs are never deleted.
- Release/tag creation cannot run before a successful Pages deploy.
- A release failure does not roll back the already successful Pages deployment, but remains visible as a failed workflow job requiring repair.
