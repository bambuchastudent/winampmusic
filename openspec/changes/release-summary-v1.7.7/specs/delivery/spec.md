# Delivery lifecycle delta — release summary v1.7.7

## Requirement: release page starts with a compact typed summary

A GitHub Release created from a merged PR MUST begin with a short classification and one-line summary before the full PR details.

### Scenario: feature branch release

Given the deployed merge came from a PR whose head branch starts with `feature/` or `feat/`, the Release starts with a `Feature` section and a one-line summary.

### Scenario: bugfix branch release

Given the deployed merge came from a PR whose head branch starts with `fix/`, `bugfix/` or `hotfix/`, the Release starts with a `Bugfix` section and a one-line summary.

### Scenario: other branch release

Given the deployed merge came from any other PR head branch, the Release starts with a `Maintenance` section and a one-line summary.

## Requirement: compact summary does not replace traceability

The Release MUST retain the merged PR title, URL and body together with the deployed revision, SHA and Pages URL.
