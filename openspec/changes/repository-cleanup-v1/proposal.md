# Proposal: repository cleanup v1

## Problem
The repository contains multiple generations of runtime, recovery, test, workflow, and documentation files. Version numbers and apparent age are not sufficient evidence that a file is unused because current Ámpula MP still relies on older-named modules through direct startup, lazy loading, service-worker caching, compatibility APIs, and historical production contracts.

## Goal
Reduce only proven-dead repository files without changing user-visible behavior, runtime compatibility, playback/import behavior, sharing, PWA behavior, or product branding.

## Scope
- inventory root runtime files, tests, OpenSpec history, and GitHub Actions before removal;
- trace direct and lazy script references, window APIs, service-worker/manifest references, tests, workflows, and deploy inputs;
- remove only files for which no current dependency remains;
- add an automated repository-integrity contract for current runtime and lazy-loading targets;
- keep historical files when they are still referenced or when URL/runtime compatibility is uncertain.

## Non-goals
- no UX or feature changes;
- no renaming of compatibility localStorage keys or runtime identifiers;
- no consolidation of the historical runtime stack in this change;
- no removal of OpenSpec history merely to reduce file count;
- no retirement of old workflows unless their coupled legacy files are handled in a separate, explicit decision.

## Success criteria
- every local startup script and current lazy-loaded JavaScript target resolves to an existing file;
- PWA manifest and service-worker file references resolve;
- current Ámpula MP branding, Now Playing/import preservation, Apple provenance/playability separation, Share/QR, shared-link receiving, and background/recovery contracts remain unchanged;
- removed filenames have no remaining production, test, workflow, PWA, or build references;
- targeted cleanup tests pass independently of already-stale historical CI contracts.
