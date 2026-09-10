# Proposal: resolver final trust gate v1.6.7

## Problem
A production diagnostic captured `Madigan — The News` being persisted as trusted YouTube id `vuJwrcKQ7Sg` (`News in the Past: Kathleen Madigan`) even though the returned candidate duration was 262s versus the canonical 279s. The current matcher contract says candidates outside ±15s are rejected, so a consumer must not blindly trust a matcher result or stamp it as trusted.

## Goal
Add an independent final trust gate in front of the public matcher API used by current-track resolution and two-track prefetch. A candidate can reach persistence only after the final gate validates its id, duration, title identity, and artist identity against canonical origin metadata.

## Scope
- Add a shared final trust gate runtime.
- Load it before diagnostics and prefetch so it wraps the public matcher API before those consumers use it.
- Remove legacy `music-only-v1.6.4` trust markers from already-saved Spotify/Apple rows once, forcing them through current-track revalidation.
- Cache-bust diagnostics/prefetch child loaders and refresh the service-worker cache/build.
- Surface final-gate rejection reasons through the existing diagnostics catch/trace path.

## Non-goals
- Do not change canonical Spotify/Apple title or artist.
- Do not eagerly resolve whole playlists.
- Do not loosen the two-track prefetch window.

## Success criteria
- `Madigan — The News` cannot persist `News in the Past: Kathleen Madigan` as a trusted match.
- A 17-second duration mismatch is rejected when canonical duration is known.
- Short ambiguous titles require stronger title identity than a single shared keyword.
- Existing saved v1.6.4 trust is revoked once so stale matches are retried safely.
- Existing correct Topic/official music matches continue to pass.
