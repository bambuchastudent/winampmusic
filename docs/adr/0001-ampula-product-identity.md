# ADR 0001: Ámpula / Ámpulamp product identity

- Status: Accepted
- Date: 2026-08-24

## Context

The repository started as `winampmusic` and its implementation was initially described mainly as a small player around provider-specific imports. That framing is too narrow for the intended product and can cause future contributors or coding agents to optimize around a particular service instead of the durable concept.

The product needs stable names and a stable object boundary so that implementation choices do not accidentally redefine the idea.

## Decision

The user-facing player is named **Ámpulamp**. The ending **MP** means **Music Player**.

The portable object handled by the player is named **Ámpula**. An Ámpula represents a deliberately shared musical moment: an ordered set of tracks plus enough identity/context information to attempt reconstruction later. It is transferred as a **`.ampula`** file.

The core product promise is that an Ámpula can be given to another person and opened now or later. Playback should be recovered from music sources available to the recipient when possible.

Provider URLs, provider-specific identifiers and catalog matches are treated as provenance and recovery candidates rather than the canonical identity of the musical moment. The source used during creation may differ from the source used during later playback.

Ámpulamp is not defined as a streaming service, centralized hosted music catalog, mandatory social network, or replacement for existing music providers.

## Consequences

- Product/domain code should prefer provider-independent concepts.
- Provider integrations should behave as import, resolution and playback adapters.
- `.ampula` must be designed as a versionable portable format rather than a serialized pointer to one service.
- Source provenance and actual playability should be modeled separately.
- The legacy repository name `winampmusic` may remain for infrastructure compatibility but does not define product naming.
- Changes that intentionally reverse or materially alter this decision require a new ADR that supersedes this one and a matching change to `AMPULA_SPEC.md`.

## Canonical specification

See [`../../AMPULA_SPEC.md`](../../AMPULA_SPEC.md).