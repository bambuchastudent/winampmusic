# Proposal — release lifecycle v1.7.6

## Problem

Production Pages deployments currently stamp a visible revision but do not create a matching Git tag or GitHub Release. Merged feature branches also remain in the repository. This makes it harder to answer what exactly was published at a given visible revision and leaves obsolete branches behind.

## Goal

Make each successful production deployment traceable and self-describing: the deployed revision becomes a Git tag and GitHub Release with release notes, and merged same-repository PR branches are deleted automatically.

## Scope

- Reuse the exact footer revision (`rYYMMDDHHMM`) as the Git tag/release identifier.
- Create the tag/release only after the Pages deploy job succeeds.
- Populate the GitHub Release page with the merged PR title/body when the deployed commit is associated with a PR, with a commit-message fallback for non-PR pushes.
- Include deployment revision, commit SHA and Pages URL in the release notes.
- Delete a same-repository PR head branch after that PR is merged.
- Never delete `develop`, `main` or `master`.

## Non-goals

- Do not create releases for failed deployments.
- Do not tag PR heads before merge.
- Do not delete branches for closed-but-unmerged PRs or branches from forks.

## Success criteria

1. A successful `develop` Pages deployment stamps one revision and emits a Git tag with exactly the same revision.
2. A GitHub Release with that revision exists and describes the published PR/change plus deployment metadata.
3. A failed deploy creates neither tag nor release.
4. A merged same-repository feature branch is removed automatically.
5. Closed-unmerged and fork branches are untouched.
