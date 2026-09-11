# Delivery lifecycle delta — v1.7.6

## Requirement: deployed revision is a release identity

A successful production Pages deployment MUST create a Git tag and GitHub Release whose identifier exactly matches the revision stamped into the deployed footer.

### Scenario: successful develop deployment

Given a `develop` push passes verification and Pages deploy succeeds with footer revision `rYYMMDDHHMM`, the repository contains tag `rYYMMDDHHMM` targeting the deployed SHA and a GitHub Release with the same identifier.

## Requirement: release page explains what was published

The GitHub Release MUST contain a human-readable `Published` section. For a merge commit associated with a PR, it MUST include that PR's title/body and URL. It MUST also include the deployed revision, SHA and Pages URL.

### Scenario: merged PR release

Given the deployed commit belongs to a merged PR, the generated release notes identify that PR and carry its release summary.

## Requirement: failed deploy is not tagged

Tag/release creation MUST depend on the successful Pages deploy job.

### Scenario: Pages deploy fails

Given verification or deployment fails, no production revision tag or GitHub Release is created for that run.

## Requirement: merged feature branches are cleaned up

A same-repository PR head branch MUST be deleted after the PR is merged. Closed-unmerged PRs and fork branches MUST remain untouched.
