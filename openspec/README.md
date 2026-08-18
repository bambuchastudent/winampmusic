# Winamp Music OpenSpec workflow

Production changes are spec-driven.

For each user-visible/runtime change:

1. Create `openspec/changes/<change-id>/proposal.md` describing the problem, goal, scope, non-goals, and success criteria.
2. Add `design.md` describing architecture, ownership, critical-path constraints, compatibility, and failure modes.
3. Add one or more spec deltas under `openspec/changes/<change-id>/specs/<capability>/spec.md` using requirements and executable scenarios.
4. Add `tasks.md` and keep it updated as implementation/testing progresses.
5. Add or update automated tests that directly encode the scenarios before merge.
6. Implement the smallest change that satisfies the spec.
7. Merge only after the spec contract and targeted behavioral tests pass.

## Core FAST invariant

Playback controls and the saved local library are the product core. Optional features must never own or block core interaction events and must stay outside the critical startup path unless their spec explicitly changes that invariant.
