# Proposal — compact release summaries v1.7.7

## Problem

Production Releases currently copy the whole PR body before the deployment metadata. The page is useful for auditing, but the first screen does not quickly tell a reader whether the release is a feature, a bugfix, or maintenance work, nor what changed in one sentence.

## Change

Keep revision tags and full PR details, but add a compact release summary at the top of every PR-backed GitHub Release. Classify the merged change from the PR head branch (`feature/` or `feat/` → Feature, `fix/`, `bugfix/` or `hotfix/` → Bugfix, otherwise Maintenance) and show one short summary line before the detailed PR body.

## Non-goals

- No semantic-version release train.
- No AI-generated release notes in CI.
- No change to Ámpula identity, resolver trust, or playback metadata.
