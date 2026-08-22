# Tasks: stabilize AmpMusic 1.5

## Current stabilization
- [x] Define stabilization scope: AmpMusic 1.5, no unapproved major version, logo unchanged.
- [x] Record next 1.5 roadmap stage: improved import + Telegram interface (roadmap only, not implemented now).
- [x] Add framework-evaluation requirement for an AI-agent-friendly universal UI stack without changing the current UI yet.
- [ ] Restore canonical `AmpMusic` branding in the shell and PWA manifest while keeping the existing visual logo/icon.
- [ ] Remove the visible 2.0 teaser from production UI and tests.
- [ ] Restore active PWA/service-worker behavior for the FAST 1.5 shell.
- [ ] Restore YouTube multi-track playlist `postMessage` import and ACK contract in the FAST shell.
- [ ] Keep single-track YouTube and Apple Music import working.
- [ ] Keep background/media-session, Gift/QR, Clear, filtering and FAST playback behavior working.
- [ ] Add regression tests for branding/version lock, PWA wiring and multi-track playlist import.
- [ ] Run functional tests.
- [ ] Run mutation tests.
- [ ] Run performance/startup budget tests.
- [ ] Merge only after gates are green.
- [ ] Verify deployed production URL in Android Chrome.

## 1.5 follow-up checklist — do not implement in this stabilization PR
- [ ] Improve/import whole playlists and track collections with clear progress and deduplication behavior.
- [ ] Specify and design the Telegram interface / Telegram Mini App path for AmpMusic while keeping public version 1.5.
- [ ] Research an optional migration to a mainstream universal/component UI framework that is friendly to AI coding agents.
- [ ] Compare candidate stacks on static/PWA deployment, TypeScript/schema structure, automated tests, agent editability, mobile performance, Telegram UI reuse, accessibility and migration risk.
- [ ] Produce a recommendation including an explicit **keep current lightweight UI** option.
- [ ] Do not begin framework migration without a separate approved OpenSpec change.
