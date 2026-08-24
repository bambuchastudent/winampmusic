# Contributing to Ámpulamp

Thanks for helping build Ámpulamp.

## Read this first

Before changing product behavior or architecture, read:

1. [`README.md`](./README.md) — public overview and current implementation.
2. [`AMPULA_SPEC.md`](./AMPULA_SPEC.md) — canonical product definition.
3. [`AGENTS.md`](./AGENTS.md) — repository invariants and development rules used by coding agents and useful to human contributors.
4. [`docs/adr/`](./docs/adr/) — accepted durable decisions and their rationale.

## Product contract

The names and roles are deliberate:

- **Ámpulamp** = the music player (`MP` = Music Player).
- **Ámpula** = the portable musical moment.
- **`.ampula`** = the transferable representation of that moment.

Ámpulamp exists to make a musical moment portable across time and, where possible, across music providers. A provider URL is evidence about where a recording came from or may be recovered; it is not by itself the identity or guarantee of playability.

## Changing the contract

Code must not silently redefine the product.

If a pull request intentionally changes naming, `.ampula` semantics, portability, track identity, recovery behavior, or product boundaries:

- update `AMPULA_SPEC.md` in the same PR;
- add a new ADR or supersede an existing ADR under `docs/adr/`;
- explain the compatibility impact in the PR description.

For implementation-only changes that preserve the contract, no specification rewrite is required.

## Pull request expectations

Describe what changed, how it was verified, and whether it affects:

- product identity/naming;
- `.ampula` format or semantics;
- track identity and recovery;
- provider playability/resolution;
- persistence and portability.

Prefer small changes that keep provider-specific code behind clear adapters and preserve provider-independent domain concepts.